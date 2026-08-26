import { requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdjustStockForm } from "./adjust-stock-form";
import Decimal from "decimal.js";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ editVariant?: string }>;
}) {
  const { editVariant } = await searchParams;
  const ctx = await requireAuthContext();

  const [variants, warehouses] = await Promise.all([
    ctx.db.productVariant.findMany({
      where: { isActive: true, product: { organizationId: ctx.organizationId, isActive: true } },
      include: {
        product: true,
        inventoryItems: { include: { warehouse: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    ctx.db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  // Pivot: variant -> warehouseId -> quantity
  const rows = variants.map((v) => {
    const byWarehouse = new Map<string, Decimal>();
    for (const item of v.inventoryItems) {
      const prev = byWarehouse.get(item.warehouseId) ?? new Decimal(0);
      byWarehouse.set(item.warehouseId, prev.plus(item.quantity.toString()));
    }
    const total = Array.from(byWarehouse.values()).reduce(
      (sum, q) => sum.plus(q),
      new Decimal(0)
    );
    return {
      variantId: v.id,
      imageUrl: v.product.imageUrl,
      label: `${v.product.name}${v.name !== v.product.name ? ` — ${v.name}` : ""}`,
      sku: v.sku,
      reorderLevel: new Decimal(v.reorderLevel.toString()),
      byWarehouse,
      total,
    };
  });

  const lowStockCount = rows.filter((r) => r.total.lessThanOrEqualTo(r.reorderLevel)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Inventory</h1>
            <p className="text-sm text-muted-foreground">
            Stock on hand across {warehouses.length} warehouse{warehouses.length === 1 ? "" : "s"}
          </p>
        </div>
        {lowStockCount > 0 && (
          <Badge variant="warning">
            {lowStockCount} item{lowStockCount === 1 ? "" : "s"} at or below reorder level
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock levels</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No products yet. Add products first to see stock levels here.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Product</th>
                  <th className="px-5 py-2 font-medium">SKU</th>
                  {warehouses.map((w) => (
                    <th key={w.id} className="px-5 py-2 font-medium text-right">
                      {w.name}
                    </th>
                  ))}
                  <th className="px-5 py-2 font-medium text-right">Total</th>
                  <th className="px-5 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const low = r.total.lessThanOrEqualTo(r.reorderLevel);
                  return (
                    <tr key={r.variantId}>
                      <td className="px-5 py-3 font-medium">
                        <div className="flex items-center gap-3">
                          {r.imageUrl && <img src={r.imageUrl} alt="" className="h-10 w-10 rounded border object-cover" />}
                          <span>{r.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-tabular text-muted-foreground">{r.sku}</td>
                      {warehouses.map((w) => (
                        <td key={w.id} className="px-5 py-3 text-right font-tabular">
                          {(r.byWarehouse.get(w.id) ?? new Decimal(0)).toString()}
                        </td>
                      ))}
                      <td className="px-5 py-3 text-right font-tabular font-semibold">
                        {r.total.toString()}
                        {low && (
                          <Badge variant="warning" className="ml-2">
                            Low
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <a href={`?editVariant=${r.variantId}#edit-inventory`} className="text-[13px] font-medium text-primary hover:underline">
                          Edit
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <AdjustStockForm
        initialVariantId={editVariant}
        variants={rows.map((r) => ({ id: r.variantId, label: `${r.label} (${r.sku})` }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
      />
    </div>
  );
}
