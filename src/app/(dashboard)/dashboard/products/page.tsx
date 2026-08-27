import Link from "next/link";
import { assertPermission, requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Decimal from "decimal.js";
import { ProductActions } from "./product-actions";
import { Archive, Boxes, Package, Plus, Search, Tag } from "lucide-react";
import { ExportLink } from "../reports/export-link";

const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

function stockStatus(stock: Decimal, reorderLevel: Decimal) {
  if (stock.isZero()) return { label: "Out of stock", variant: "danger" as const };
  if (stock.lessThanOrEqualTo(reorderLevel)) return { label: "Low stock", variant: "warning" as const };
  return { label: "Healthy", variant: "success" as const };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireAuthContext();
  assertPermission(ctx, "PRODUCTS_VIEW");
  const params = searchParams ? await searchParams : {};
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : "";
  const brandId = typeof params.brandId === "string" ? params.brandId : "";
  const stockFilter = typeof params.stock === "string" ? params.stock : "";

  const [products, categories, brands] = await Promise.all([
    ctx.db.product.findMany({
      where: { isActive: true, ...(categoryId ? { categoryId } : {}), ...(brandId ? { brandId } : {}), ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { variants: { some: { sku: { contains: query, mode: "insensitive" } } } }, { variants: { some: { barcodes: { some: { barcode: { contains: query, mode: "insensitive" } } } } } }] } : {}) },
      include: { category: true, brand: true, primarySupplier: true, variants: { include: { barcodes: true, taxRate: true, inventoryItems: { select: { quantity: true } } } } },
      orderBy: { updatedAt: "desc" },
    }),
    ctx.db.category.findMany({ orderBy: { name: "asc" } }),
    ctx.db.brand.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows = products.map((product) => {
    const totalStock = product.variants.reduce((sum, variant) => sum.plus(variant.inventoryItems.reduce((inner, item) => inner.plus(item.quantity.toString()), new Decimal(0))), new Decimal(0));
    const lowStock = product.variants.some((variant) => {
      const stock = variant.inventoryItems.reduce((sum, item) => sum.plus(item.quantity.toString()), new Decimal(0));
      return stock.lessThanOrEqualTo(variant.reorderLevel.toString()) && !stock.isZero();
    });
    const outOfStock = totalStock.isZero();
    return { product, totalStock, lowStock, outOfStock, primaryVariant: product.variants[0] };
  }).filter((row) => !stockFilter || (stockFilter === "LOW" && row.lowStock) || (stockFilter === "OUT" && row.outOfStock) || (stockFilter === "IN" && !row.lowStock && !row.outOfStock));

  const activeProducts = products.length;
  const variantsCount = products.reduce((sum, product) => sum + product.variants.length, 0);
  const lowStockCount = rows.filter((row) => row.lowStock).length;
  const outOfStockCount = rows.filter((row) => row.outOfStock).length;
  const unpricedCount = products.reduce((sum, product) => sum + product.variants.filter((variant) => new Decimal(variant.sellingPrice.toString()).lessThanOrEqualTo(0)).length, 0);
  const kpis = [
    { label: "Active products", value: activeProducts.toLocaleString(), detail: "Available in the catalog", icon: Package },
    { label: "Variants", value: variantsCount.toLocaleString(), detail: "Independent SKUs", icon: Boxes },
    { label: "Low stock", value: String(lowStockCount), detail: `${outOfStockCount} out of stock`, icon: Archive },
    { label: "Unpriced", value: String(unpricedCount), detail: "Review before POS use", icon: Tag },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Catalog control</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Products</h1><p className="mt-2 text-sm text-muted-foreground">Manage the catalog that powers pricing, purchasing, POS, and inventory.</p></div><div className="flex gap-2"><ExportLink type="products" label="Export products" /><Link href="/dashboard/products/new"><Button><Plus size={16} /> Add product</Button></Link></div></div>
      <nav className="flex gap-5 overflow-x-auto border-b border-border pb-3 text-sm" aria-label="Product navigation"><Link className="whitespace-nowrap border-b-2 border-primary pb-3 font-semibold text-primary" href="/dashboard/products">All products</Link><span className="whitespace-nowrap text-muted-foreground">Categories · {categories.length}</span><span className="whitespace-nowrap text-muted-foreground">Brands · {brands.length}</span><span className="whitespace-nowrap text-muted-foreground">Variants · {variantsCount}</span><span className="whitespace-nowrap text-muted-foreground">Pricing</span><span className="whitespace-nowrap text-muted-foreground">Import / export</span></nav>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((item) => { const Icon = item.icon; return <Card key={item.label}><CardContent className="p-4"><div className="flex items-center justify-between"><p className="text-[12px] text-muted-foreground">{item.label}</p><Icon size={17} className="text-primary" /></div><p className="mt-4 text-xl font-semibold font-tabular">{item.value}</p><p className="mt-1 text-[12px] text-muted-foreground">{item.detail}</p></CardContent></Card>; })}</div>

      <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Product catalog</CardTitle><p className="mt-1 text-[12px] text-muted-foreground">{rows.length} matching product{rows.length === 1 ? "" : "s"}</p></div><form method="get" className="flex flex-wrap gap-2"><div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" /><input name="q" defaultValue={query} placeholder="Name, SKU or barcode" className="h-9 w-52 rounded-[var(--radius-sm)] border border-border-strong bg-surface pl-9 pr-3 text-sm" /></div><select name="categoryId" defaultValue={categoryId} className="h-9 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-2 text-sm"><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select name="brandId" defaultValue={brandId} className="h-9 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-2 text-sm"><option value="">All brands</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select><select name="stock" defaultValue={stockFilter} className="h-9 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-2 text-sm"><option value="">All stock</option><option value="IN">Healthy</option><option value="LOW">Low stock</option><option value="OUT">Out of stock</option></select><button className="h-9 rounded-[var(--radius-sm)] border border-border px-3 text-sm hover:bg-surface-muted">Filter</button></form></div></CardHeader><CardContent className="p-0 overflow-x-auto">
          {products.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No products yet. Add your first one to start tracking stock.
            </p>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-y border-border bg-surface-muted text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Product</th><th className="px-3 py-2 font-medium">SKU / barcode</th><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 font-medium">Supplier</th><th className="px-3 py-2 font-medium text-right">Stock</th><th className="px-3 py-2 font-medium text-right">Cost</th><th className="px-3 py-2 font-medium text-right">Price</th><th className="px-5 py-2 font-medium text-right">Status</th><th className="px-5 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ product: p, totalStock, primaryVariant }) => {
                  const status = stockStatus(totalStock, primaryVariant ? new Decimal(primaryVariant.reorderLevel.toString()) : new Decimal(0));
                  return (
                    <tr key={p.id} className="hover:bg-surface-muted"><td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {p.imageUrl && <img src={p.imageUrl} alt="" className="h-10 w-10 rounded border object-cover" />}
                          <div>
                            <Link
                              href={`/dashboard/products/${p.id}`}
                              className="font-medium text-foreground hover:text-primary"
                            >
                              {p.name}
                            </Link>
                        <p className="text-[12px] text-muted-foreground">{p.brand?.name ?? "No brand"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{primaryVariant?.sku ?? "—"}<br /><span className="text-[11px]">{primaryVariant?.barcodes[0]?.barcode ?? "No barcode"}</span></td><td className="px-3 py-3 text-muted-foreground">{p.category?.name ?? "Uncategorized"}</td><td className="px-3 py-3 text-[12px] text-muted-foreground">{p.primarySupplier?.name ?? "—"}</td><td className="px-3 py-3 text-right font-tabular font-semibold">{totalStock.toFixed(3)}</td><td className="px-3 py-3 text-right font-tabular text-muted-foreground">{primaryVariant ? money.format(Number(primaryVariant.costPrice)) : "—"}</td><td className="px-3 py-3 text-right font-tabular">{primaryVariant ? money.format(Number(primaryVariant.sellingPrice)) : "—"}</td><td className="px-5 py-3 text-right"><Badge variant={status.variant}>{status.label}</Badge></td>
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
