import { requireAuthContext } from "@/server/auth/context";
import { PosForm } from "./pos-form";
import { CashSessionForm } from "./cash-session-form";
import { CloseSessionForm } from "./close-session-form";
import { Card, CardContent } from "@/components/ui/card";

export default async function PosPage() {
  const ctx = await requireAuthContext();
  const [branches, warehouses, registers, variants, customers, openSession, recentSales] = await Promise.all([
    ctx.db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ctx.db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ctx.db.register.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ctx.db.productVariant.findMany({ where: { isActive: true, product: { isActive: true } }, include: { product: { include: { category: true } }, inventoryItems: { select: { quantity: true } } }, orderBy: { product: { name: "asc" } } }),
    ctx.db.customer.findMany({ where: { isWalkIn: false }, orderBy: { name: "asc" } }),
    ctx.db.cashSession.findFirst({ where: { userId: ctx.userId, status: "OPEN" }, include: { branch: true, register: true } }),
    ctx.db.sale.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { payments: true } }),
  ]);
  return <div className="pos-workspace space-y-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">DukaOS POS</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">New sale</h1><p className="mt-1 text-sm text-muted-foreground">Find products, build the basket, and take payment without leaving the screen.</p></div>{openSession ? <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-success/20 bg-success-tint px-3 py-2 text-sm text-success"><span className="h-2 w-2 rounded-full bg-success" />{openSession.branch.name} · {openSession.register.name}<CloseSessionForm sessionId={openSession.id} /></div> : <Card><CardContent className="flex items-center gap-3 p-3"><span className="text-sm text-muted-foreground">Register is closed</span><CashSessionForm branchId={branches[0]?.id ?? ""} registerId={registers.find((item) => item.branchId === branches[0]?.id)?.id ?? ""} /></CardContent></Card>}</div><PosForm customers={customers.map((item) => ({ id: item.id, name: item.name }))} branches={branches.map((item) => ({ id: item.id, name: item.name }))} warehouses={warehouses.map((item) => ({ id: item.id, name: item.name, branchId: item.branchId }))} registers={registers.map((item) => ({ id: item.id, name: item.name, branchId: item.branchId }))} variants={variants.map((item) => ({ id: item.id, name: item.product.name, label: `${item.product.name}${item.name !== item.product.name ? ` - ${item.name}` : ""}`, sku: item.sku, price: item.sellingPrice.toString(), imageUrl: item.product.imageUrl, category: item.product.category?.name ?? "Other", stock: item.inventoryItems.reduce((sum, inventory) => sum + Number(inventory.quantity), 0) }))} /><Card><CardContent className="p-0"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-semibold">Recent receipts</h2><p className="mt-1 text-[12px] text-muted-foreground">Latest completed transactions</p></div></div><div className="divide-y divide-border">{recentSales.map((sale) => <div key={sale.id} className="flex justify-between px-5 py-3 text-sm"><span>{sale.receiptNumber} <span className="text-muted-foreground">{sale.status}</span></span><span className="font-tabular">KES {sale.total.toString()}</span></div>)}</div></CardContent></Card></div>;
}
