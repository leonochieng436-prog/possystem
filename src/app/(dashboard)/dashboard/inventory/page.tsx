import Decimal from "decimal.js";
import { Archive, ArrowDownLeft, ArrowUpRight, ClipboardList, Plus, RefreshCw } from "lucide-react";
import { assertPermission, requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdjustStockForm } from "./adjust-stock-form";

const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

function stockStatus(quantity: Decimal, reorderLevel: Decimal) {
  if (quantity.isZero()) return { label: "Out of stock", variant: "danger" as const };
  if (quantity.lessThanOrEqualTo(reorderLevel)) return { label: "Low stock", variant: "warning" as const };
  return { label: "Healthy", variant: "success" as const };
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireAuthContext();
  assertPermission(ctx, "INVENTORY_VIEW");
  const params = searchParams ? await searchParams : {};
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const warehouseId = typeof params.warehouseId === "string" ? params.warehouseId : "";
  const statusFilter = typeof params.status === "string" ? params.status : "";

  const [variants, warehouses, transfers, movements, adjustments] = await Promise.all([
    ctx.db.productVariant.findMany({
      where: {
        isActive: true,
        product: { isActive: true, organizationId: ctx.organizationId },
        ...(warehouseId ? { inventoryItems: { some: { warehouseId } } } : {}),
      },
      include: { product: true, inventoryItems: { include: { warehouse: true, batch: true } } },
    }),
    ctx.db.warehouse.findMany({ where: { isActive: true }, include: { branch: true }, orderBy: { name: "asc" } }),
  ctx.db.stockTransfer.findMany({ where: { status: { in: ["DRAFT", "IN_TRANSIT"] } }, select: { id: true } }),
  ctx.db.inventoryMovement.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { variant: { include: { product: true } }, warehouse: true } }),
    ctx.db.inventoryMovement.count({ where: { type: { in: ["ADJUSTMENT", "DAMAGE", "LOSS", "STOCK_COUNT"] } } }),
  ]);

  const rows = variants.map((variant) => {
  const items = variant.inventoryItems.filter((item) => !warehouseId || item.warehouseId === warehouseId);
  const total = items.reduce((sum, item) => sum.plus(item.quantity.toString()), new Decimal(0));
  const value = items.reduce((sum, item) => sum.plus(new Decimal(item.quantity.toString()).times(item.batch?.unitCost.toString() ?? item.averageCost.toString())), new Decimal(0));
    return {
      variantId: variant.id,
      imageUrl: variant.product.imageUrl,
  label: `${variant.product.name}${variant.name !== variant.product.name ? ` - ${variant.name}` : ""}`,
  sku: variant.sku,
  reorderLevel: new Decimal(variant.reorderLevel.toString()),
  total,
  value,
  locations: [...new Set(items.map((item) => item.warehouse.name))],
    };
  }).filter((row) => {
    const status = stockStatus(row.total, row.reorderLevel).label;
    return !statusFilter || (statusFilter === "LOW" && status === "Low stock") || (statusFilter === "OUT" && status === "Out of stock") || (statusFilter === "IN" && status === "Healthy");
  });

  const totalUnits = rows.reduce((sum, row) => sum.plus(row.total), new Decimal(0));
  const totalValue = rows.reduce((sum, row) => sum.plus(row.value), new Decimal(0));
  const lowStock = rows.filter((row) => row.total.lessThanOrEqualTo(row.reorderLevel) && !row.total.isZero()).length;
  const outOfStock = rows.filter((row) => row.total.isZero()).length;
  const kpis = [
    { label: "Active products", value: rows.length.toLocaleString(), detail: "Tracked inventory variants", icon: Archive },
    { label: "Stock units", value: totalUnits.toFixed(0), detail: "Across selected warehouses", icon: ClipboardList },
    { label: "Stock value", value: money.format(totalValue.toNumber()), detail: "Based on FIFO cost layers", icon: ArrowUpRight },
    { label: "Low stock", value: String(lowStock), detail: `${outOfStock} out of stock`, icon: RefreshCw },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Stock control</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Inventory</h1><p className="mt-2 text-sm text-muted-foreground">Track stock across warehouses with an auditable movement ledger.</p></div>
        <a href="#edit-inventory" className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_5px_14px_rgba(15,123,108,0.18)]"><Plus size={16} /> Stock adjustment</a>
      </div>
  <nav className="flex gap-5 overflow-x-auto border-b border-border pb-3 text-sm" aria-label="Inventory navigation"><a className="border-b-2 border-primary pb-3 font-semibold text-primary" href="/dashboard/inventory">Overview</a><a className="whitespace-nowrap text-muted-foreground" href="#stock-levels">Stock levels</a><a className="whitespace-nowrap text-muted-foreground" href="#movements">Movements</a><span className="whitespace-nowrap text-muted-foreground">Transfers · {transfers.length} pending</span><span className="whitespace-nowrap text-muted-foreground">Adjustments · {adjustments}</span></nav>
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((item) => { const Icon = item.icon; return <Card key={item.label}><CardContent className="p-4"><div className="flex items-center justify-between"><p className="text-[12px] text-muted-foreground">{item.label}</p><Icon size={17} className="text-primary" /></div><p className="mt-4 text-xl font-semibold font-tabular">{item.value}</p><p className="mt-1 text-[12px] text-muted-foreground">{item.detail}</p></CardContent></Card>; })}</div>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card id="stock-levels"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Stock levels</CardTitle><p className="mt-1 text-[12px] text-muted-foreground">{rows.length} products in this view</p></div><form method="get" className="flex flex-wrap gap-2"><input name="q" defaultValue={query} placeholder="Search products" className="h-9 w-44 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm" /><select name="warehouseId" defaultValue={warehouseId} className="h-9 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-2 text-sm"><option value="">All warehouses</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select><select name="status" defaultValue={statusFilter} className="h-9 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-2 text-sm"><option value="">All stock</option><option value="IN">Healthy</option><option value="LOW">Low stock</option><option value="OUT">Out of stock</option></select><button className="h-9 rounded-[var(--radius-sm)] border border-border px-3 text-sm hover:bg-surface-muted">Filter</button></form></div></CardHeader><CardContent className="p-0 overflow-x-auto">{rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No stock matches these filters.</p> : <table className="w-full min-w-[760px] text-sm"><thead><tr className="border-y border-border bg-surface-muted text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="px-5 py-2">Product</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Warehouse</th><th className="px-3 py-2 text-right">On hand</th><th className="px-3 py-2 text-right">Reorder</th><th className="px-3 py-2 text-right">Value</th><th className="px-5 py-2 text-right">Status</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => { const status = stockStatus(row.total, row.reorderLevel); return <tr key={row.variantId}><td className="px-5 py-3"><div className="flex items-center gap-3">{row.imageUrl && <img src={row.imageUrl} alt="" className="h-9 w-9 rounded border object-cover" />}<div><p className="font-medium">{row.label}</p><p className="text-[11px] text-muted-foreground">{row.locations.join(", ") || "No stock recorded"}</p></div></div></td><td className="px-3 py-3 font-tabular text-muted-foreground">{row.sku}</td><td className="px-3 py-3 text-[12px] text-muted-foreground">{warehouseId ? warehouses.find((warehouse) => warehouse.id === warehouseId)?.name : `${row.locations.length} location${row.locations.length === 1 ? "" : "s"}`}</td><td className="px-3 py-3 text-right font-tabular font-semibold">{row.total.toFixed(3)}</td><td className="px-3 py-3 text-right font-tabular text-muted-foreground">{row.reorderLevel.toFixed(0)}</td><td className="px-3 py-3 text-right font-tabular">{money.format(row.value.toNumber())}</td><td className="px-5 py-3 text-right"><Badge variant={status.variant}>{status.label}</Badge></td></tr>; })}</tbody></table>}</CardContent></Card>
        <Card id="movements"><CardHeader><CardTitle>Recent activity</CardTitle><p className="text-[12px] text-muted-foreground">Latest append-only ledger movements</p></CardHeader><CardContent className="space-y-4">{movements.length === 0 ? <p className="text-sm text-muted-foreground">No stock movements yet.</p> : movements.map((movement) => { const positive = Number(movement.quantity) >= 0; return <div key={movement.id} className="flex gap-3"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${positive ? "bg-success-tint text-success" : "bg-warning-tint text-warning"}`}>{positive ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}</span><div className="min-w-0"><p className="text-sm font-medium">{movement.variant.product.name}</p><p className="text-[12px] text-muted-foreground">{movement.type.replaceAll("_", " ")} · {movement.warehouse.name}</p><p className={`text-[12px] font-tabular ${positive ? "text-success" : "text-warning"}`}>{positive ? "+" : ""}{movement.quantity.toString()} units · {movement.createdAt.toLocaleDateString("en-KE")}</p></div></div>; })}</CardContent></Card>
      </div>
      <Card id="alerts"><CardHeader><CardTitle>Inventory attention</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><div className="rounded-[var(--radius-sm)] bg-warning-tint px-4 py-3"><p className="text-lg font-semibold font-tabular">{lowStock}</p><p className="text-[12px] text-muted-foreground">Products at or below reorder</p></div><div className="rounded-[var(--radius-sm)] bg-danger-tint px-4 py-3"><p className="text-lg font-semibold font-tabular">{outOfStock}</p><p className="text-[12px] text-muted-foreground">Products out of stock</p></div><div className="rounded-[var(--radius-sm)] bg-primary-tint px-4 py-3"><p className="text-lg font-semibold font-tabular">{transfers.length}</p><p className="text-[12px] text-muted-foreground">Transfers awaiting completion</p></div></CardContent></Card>
      <div id="edit-inventory"><AdjustStockForm initialVariantId={typeof params.editVariant === "string" ? params.editVariant : undefined} variants={variants.map((variant) => ({ id: variant.id, label: `${variant.product.name}${variant.name !== variant.product.name ? ` - ${variant.name}` : ""} (${variant.sku})` }))} warehouses={warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name }))} /></div>
    </div>
  );
}
