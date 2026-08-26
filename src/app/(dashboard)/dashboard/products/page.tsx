import Link from "next/link";
import { requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Decimal from "decimal.js";
import { ProductActions } from "./product-actions";

export default async function ProductsPage() {
  const ctx = await requireAuthContext();

  const products = await ctx.db.product.findMany({
    where: { isActive: true },
    include: {
      category: true,
      brand: true,
      variants: {
        include: {
          barcodes: true,
          inventoryItems: { select: { quantity: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} product{products.length === 1 ? "" : "s"} in your catalog
          </p>
        </div>
        <Link href="/dashboard/products/new">
          <Button>Add product</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No products yet. Add your first one to start tracking stock.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Product</th>
                  <th className="px-5 py-2 font-medium">Category</th>
                  <th className="px-5 py-2 font-medium">Variants</th>
                  <th className="px-5 py-2 font-medium text-right">Stock on hand</th>
                  <th className="px-5 py-2 font-medium text-right">Selling price</th>
                  <th className="px-5 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => {
                  const totalStock = p.variants.reduce(
                    (sum, v) =>
                      sum.plus(
                        v.inventoryItems.reduce(
                          (s, i) => s.plus(i.quantity.toString()),
                          new Decimal(0)
                        )
                      ),
                    new Decimal(0)
                  );
                  const lowStock = p.variants.some((v) => {
                    const vQty = v.inventoryItems.reduce(
                      (s, i) => s.plus(i.quantity.toString()),
                      new Decimal(0)
                    );
                    return vQty.lessThanOrEqualTo(v.reorderLevel.toString());
                  });
                  const primaryVariant = p.variants[0];

                  return (
                    <tr key={p.id} className="hover:bg-surface-muted">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {p.imageUrl && <img src={p.imageUrl} alt="" className="h-10 w-10 rounded border object-cover" />}
                          <div>
                            <Link
                              href={`/dashboard/products/${p.id}`}
                              className="font-medium text-foreground hover:text-primary"
                            >
                              {p.name}
                            </Link>
                        {p.brand && (
                          <p className="text-[12px] text-muted-foreground">{p.brand.name}</p>
                        )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {p.category?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{p.variants.length}</td>
                      <td className="px-5 py-3 text-right font-tabular">
                        {totalStock.toString()}
                        {lowStock && (
                          <Badge variant="warning" className="ml-2">
                            Low
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-tabular">
                        {primaryVariant
                          ? `KES ${new Decimal(primaryVariant.sellingPrice.toString()).toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/dashboard/products/${p.id}`}>
                            <Button type="button" variant="secondary" size="sm">Edit</Button>
                          </Link>
                          <ProductActions productId={p.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
