import { notFound } from "next/navigation";
import { requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddVariantForm } from "./add-variant-form";
import { EditProductForm } from "./edit-product-form";
import Decimal from "decimal.js";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const ctx = await requireAuthContext();

  const [product, taxRates, categories, brands, suppliers] = await Promise.all([
    ctx.db.product.findFirst({
      where: { id: productId, organizationId: ctx.organizationId },
      include: {
        category: true,
        brand: true,
        primarySupplier: true,
        variants: {
          include: {
            barcodes: true,
            taxRate: true,
            inventoryItems: { include: { warehouse: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    ctx.db.taxRate.findMany({ where: { isActive: true }, orderBy: { rate: "asc" } }),
    ctx.db.category.findMany({ orderBy: { name: "asc" } }),
    ctx.db.brand.findMany({ orderBy: { name: "asc" } }),
    ctx.db.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <div className="flex items-start gap-4">
          {product.imageUrl && <img src={product.imageUrl} alt="" className="h-20 w-20 rounded border object-cover" />}
          <div>
            <h1 className="text-lg font-semibold">{product.name}</h1>
        <p className="text-sm text-muted-foreground">
          {product.category?.name ?? "Uncategorized"}
          {product.brand ? ` · ${product.brand.name}` : ""}
          {product.primarySupplier ? ` · Supplied by ${product.primarySupplier.name}` : ""}
        </p>
          </div>
        </div>
      </div>

      <EditProductForm
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          brandId: product.brandId,
          primarySupplierId: product.primarySupplierId,
          unit: product.unit,
          type: product.type,
          trackExpiry: product.trackExpiry,
          imageUrl: product.imageUrl,
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Variants ({product.variants.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                <th className="px-5 py-2 font-medium">Variant</th>
                <th className="px-5 py-2 font-medium">SKU</th>
                <th className="px-5 py-2 font-medium">Barcode</th>
                <th className="px-5 py-2 font-medium text-right">Cost</th>
                <th className="px-5 py-2 font-medium text-right">Price</th>
                <th className="px-5 py-2 font-medium text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {product.variants.map((v) => {
                const stock = v.inventoryItems.reduce(
                  (sum, i) => sum.plus(i.quantity.toString()),
                  new Decimal(0)
                );
                const low = stock.lessThanOrEqualTo(v.reorderLevel.toString());
                return (
                  <tr key={v.id}>
                    <td className="px-5 py-3 font-medium">{v.name}</td>
                    <td className="px-5 py-3 font-tabular text-muted-foreground">{v.sku}</td>
                    <td className="px-5 py-3 font-tabular text-muted-foreground">
                      {v.barcodes[0]?.barcode ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-tabular">
                      {new Decimal(v.costPrice.toString()).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right font-tabular">
                      {new Decimal(v.sellingPrice.toString()).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right font-tabular">
                      {stock.toString()}
                      {low && (
                        <Badge variant="warning" className="ml-2">
                          Low
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <AddVariantForm
        productId={product.id}
        taxRates={taxRates.map((t) => ({ id: t.id, name: t.name, rate: t.rate.toString() }))}
      />
    </div>
  );
}
