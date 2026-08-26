import { requireAuthContext } from "@/server/auth/context";
import { rawPrisma } from "@/server/db/client";
import Link from "next/link";
import Decimal from "decimal.js";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Boxes, CircleDollarSign, PackagePlus, ShoppingCart, Users } from "lucide-react";

export default async function DashboardPage() {
  const ctx = await requireAuthContext();
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [organization, branchCount, memberCount, todaySales, monthSales, products, customers, recentSales] = await Promise.all([
    rawPrisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } }),
    ctx.db.branch.count(),
    rawPrisma.userOrganization.count({
      where: { organizationId: ctx.organizationId, isActive: true },
    }),
    ctx.db.sale.findMany({ where: { status: "COMPLETED", createdAt: { gte: startOfDay } }, select: { total: true, cogsTotal: true } }),
    ctx.db.sale.findMany({ where: { status: "COMPLETED", createdAt: { gte: startOfMonth } }, select: { total: true, cogsTotal: true } }),
    ctx.db.product.findMany({ where: { isActive: true }, select: { id: true, name: true, imageUrl: true, variants: { select: { reorderLevel: true, inventoryItems: { select: { quantity: true } } } } }, orderBy: { updatedAt: "desc" }, take: 5 }),
    ctx.db.customer.count({ where: { isWalkIn: false } }),
    ctx.db.sale.findMany({ where: { status: "COMPLETED" }, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);

  const sum = (values: { total: unknown }[]) => values.reduce((total, item) => total.plus(String(item.total)), new Decimal(0));
  const todayRevenue = sum(todaySales);
  const monthRevenue = sum(monthSales);
  const monthCogs = monthSales.reduce((total, item) => total.plus(String(item.cogsTotal)), new Decimal(0));
  const lowStock = products.filter((product) => product.variants.some((variant) => {
    const quantity = variant.inventoryItems.reduce((total, item) => total.plus(String(item.quantity)), new Decimal(0));
    return quantity.lessThanOrEqualTo(String(variant.reorderLevel));
  })).length;
  const formatMoney = (value: Decimal) => `KES ${value.toFixed(2)}`;

  return (
    <div className="dashboard-home space-y-6">
      <section className="dashboard-hero flex flex-col justify-between gap-6 rounded-[var(--radius-lg)] px-6 py-7 text-white shadow-[0_14px_30px_rgba(15,123,108,0.14)] sm:flex-row sm:items-end sm:px-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">{organization.name} · All Branches</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Good morning, Leon</h1>
          <p className="mt-2 max-w-md text-sm text-white/75">Here&apos;s what&apos;s happening across your business today.</p>
        </div>
        <Link href="/dashboard/pos" className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-white px-4 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5">
          <ShoppingCart size={16} /> Open POS <ArrowUpRight size={15} />
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Today's revenue", value: formatMoney(todayRevenue), note: `${todaySales.length} completed sale${todaySales.length === 1 ? "" : "s"}`, icon: CircleDollarSign, tone: "text-primary" },
          { label: "Gross profit · MTD", value: formatMoney(monthRevenue.minus(monthCogs)), note: `Revenue ${formatMoney(monthRevenue)}`, icon: ArrowUpRight, tone: "text-success" },
          { label: "Stock alerts", value: String(lowStock), note: lowStock ? "Items need attention" : "All stock levels healthy", icon: Boxes, tone: lowStock ? "text-warning" : "text-success" },
          { label: "Customers", value: String(customers), note: `${branchCount} active branches · ${memberCount} team members`, icon: Users, tone: "text-primary" },
        ].map((metric) => {
          const Icon = metric.icon;
          return <Card key={metric.label} className="metric-card"><CardContent className="flex items-start justify-between p-5"><div><p className="text-[12px] font-medium text-muted-foreground">{metric.label}</p><p className="mt-3 font-tabular text-2xl font-semibold tracking-tight">{metric.value}</p><p className="mt-1 text-[12px] text-muted-foreground">{metric.note}</p></div><span className={`grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] bg-surface-muted ${metric.tone}`}><Icon size={18} /></span></CardContent></Card>;
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-semibold">Recent sales</h2><p className="mt-1 text-[12px] text-muted-foreground">Latest completed transactions across your branches</p></div><Link href="/dashboard/reports" className="text-[12px] font-semibold text-primary hover:underline">View reports</Link></div>
            <div className="divide-y divide-border">{recentSales.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground">No completed sales yet.</p> : recentSales.map((sale) => <div key={sale.id} className="flex items-center justify-between px-5 py-3.5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-primary-tint text-primary"><ShoppingCart size={14} /></span><div><p className="text-sm font-medium">{sale.receiptNumber}</p><p className="text-[12px] text-muted-foreground">{sale.customer?.name ?? "Walk-in customer"}</p></div></div><div className="text-right"><p className="font-tabular text-sm font-semibold">{formatMoney(new Decimal(String(sale.total)))}</p><p className="text-[11px] text-muted-foreground">{sale.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div></div>)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-semibold">Quick actions</h2><p className="mt-1 text-[12px] text-muted-foreground">Keep daily operations moving</p></div><div className="grid gap-2 p-4"><Link href="/dashboard/products/new" className="quick-action"><PackagePlus size={17} /><span><strong>Add product</strong><small>Create a product and opening stock</small></span><ArrowUpRight size={15} /></Link><Link href="/dashboard/inventory" className="quick-action"><Boxes size={17} /><span><strong>Adjust inventory</strong><small>Record a stock correction</small></span><ArrowUpRight size={15} /></Link><Link href="/dashboard/customers" className="quick-action"><Users size={17} /><span><strong>Manage customers</strong><small>Review balances and credit</small></span><ArrowUpRight size={15} /></Link></div></CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card><CardContent className="p-0"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-semibold">Inventory watch</h2><p className="mt-1 text-[12px] text-muted-foreground">Recently updated products</p></div><Link href="/dashboard/inventory" className="text-[12px] font-semibold text-primary hover:underline">Open inventory</Link></div><div className="divide-y divide-border">{products.map((product) => <div key={product.id} className="flex items-center justify-between px-5 py-3"><div className="flex items-center gap-3">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-9 w-9 rounded border object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded bg-surface-muted text-muted-foreground"><Boxes size={16} /></span>}<span className="text-sm font-medium">{product.name}</span></div>{product.variants.some((variant) => variant.inventoryItems.reduce((total, item) => total.plus(String(item.quantity)), new Decimal(0)).lessThanOrEqualTo(String(variant.reorderLevel))) && <Badge variant="warning">Low stock</Badge>}</div>)}</div></CardContent></Card>
        <Card className="overflow-hidden"><CardContent className="dashboard-branch-band flex h-full flex-col justify-between p-6"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Business context</p><h2 className="mt-2 text-xl font-semibold">DUKAOS at a glance</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">One clear view of stock, sales, suppliers, customers, and profit across your growing retail operation.</p></div><div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3"><div><p className="text-[11px] text-muted-foreground">Branches</p><p className="mt-1 font-tabular text-lg font-semibold">{branchCount}</p></div><div><p className="text-[11px] text-muted-foreground">Catalog items</p><p className="mt-1 font-tabular text-lg font-semibold">{products.length}+</p></div><div><p className="text-[11px] text-muted-foreground">Month revenue</p><p className="mt-1 font-tabular text-lg font-semibold">{formatMoney(monthRevenue)}</p></div></div></CardContent></Card>
      </section>
    </div>
  );
}
