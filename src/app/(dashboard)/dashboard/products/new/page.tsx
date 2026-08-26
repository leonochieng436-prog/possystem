import { requireAuthContext } from "@/server/auth/context";
import { NewProductForm } from "./new-product-form";

export default async function NewProductPage() {
  const ctx = await requireAuthContext();

  const [categories, brands, suppliers, taxRates, warehouses] = await Promise.all([
    ctx.db.category.findMany({ orderBy: { name: "asc" } }),
    ctx.db.brand.findMany({ orderBy: { name: "asc" } }),
    ctx.db.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ctx.db.taxRate.findMany({ where: { isActive: true }, orderBy: { rate: "asc" } }),
    ctx.db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Add product</h1>
        <p className="text-sm text-muted-foreground">
          Creates the product with its first variant. Add more variants
          (sizes, colors) from the product page afterwards.
        </p>
      </div>

      <NewProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        taxRates={taxRates.map((t) => ({ id: t.id, name: t.name, rate: t.rate.toString() }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
      />
    </div>
  );
}
