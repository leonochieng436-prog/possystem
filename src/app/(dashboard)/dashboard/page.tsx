import { requireAuthContext } from "@/server/auth/context";
import Link from "next/link";
import Decimal from "decimal.js";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, Boxes, CircleDollarSign, Clock3, PackagePlus, ShoppingCart, Users } from "lucide-react";
import { getRegisterSummary, PAYMENT_METHODS } from "@/server/services/register-summary";
import { LineChart } from "@/components/charts/line-chart";
import { PieChart } from "@/components/charts/pie-chart";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireAuthContext();
  const params = searchParams ? await searchParams : {};
  const requestedBranchId = typeof params.branchId === "string" ? params.branchId : "";
  const period = params.period === "7d" || params.period === "30d" ? params.period : "today";
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const periodStart = period === "7d"
    ? new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
    : period === "30d"
      ? new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
      : startOfDay;
  periodStart.setHours(0, 0, 0, 0);
  const previousPeriodStart = new Date(periodStart.getTime() - (today.getTime() - periodStart.getTime()));
  const branchId = requestedBranchId && (ctx.branchIds === null || ctx.branchIds.includes(requestedBranchId)) ? requestedBranchId : "";
  const branchWhere = branchId ? { branchId } : ctx.branchIds ? { branchId: { in: ctx.branchIds } } : {};
  const warehouseWhere = branchId ? { warehouse: { branchId } } : ctx.branchIds ? { warehouse: { branchId: { in: ctx.branchIds } } } : {};
  const formattedDate = today.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 18 ? "Good afternoon" : "Good evening";

  const [organization, branches, periodSales, previousSales, products, recentSales, periodReturns] = await Promise.all([
    ctx.db.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } }),
    ctx.db.branch.findMany({ where: ctx.branchIds ? { id: { in: ctx.branchIds } } : { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ctx.db.sale.findMany({ where: { ...branchWhere, status: "COMPLETED", createdAt: { gte: periodStart } }, select: { total: true, cogsTotal: true, discountTotal: true, createdAt: true, items: { select: { productNameSnapshot: true, quantity: true, total: true } }, payments: { where: { status: "CONFIRMED" }, select: { method: true, amount: true } }, customerId: true } }),
    ctx.db.sale.findMany({ where: { ...branchWhere, status: "COMPLETED", createdAt: { gte: previousPeriodStart, lt: periodStart } }, select: { total: true, cogsTotal: true, discountTotal: true } }),
    ctx.db.product.findMany({ where: { isActive: true, variants: { some: { inventoryItems: { some: warehouseWhere } } } }, select: { id: true, name: true, imageUrl: true, variants: { select: { reorderLevel: true, inventoryItems: { where: warehouseWhere, select: { quantity: true, batch: { select: { unitCost: true } } } } } } }, orderBy: { updatedAt: "desc" } }),
    ctx.db.sale.findMany({ where: { ...branchWhere, status: "COMPLETED" }, include: { customer: true, payments: { where: { status: "CONFIRMED" }, select: { method: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    ctx.db.saleReturn.findMany({ where: { createdAt: { gte: periodStart }, sale: branchId ? { branchId } : ctx.branchIds ? { branchId: { in: ctx.branchIds } } : undefined }, select: { refundAmount: true } }),
  ]);
  const currentSession = await ctx.db.cashSession.findFirst({ where: { userId: ctx.userId, status: "OPEN" } });
  const currentSummary = currentSession ? await getRegisterSummary(ctx.db, currentSession.id) : null;

  const sum = (values: { total: unknown }[]) => values.reduce((total, item) => total.plus(String(item.total)), new Decimal(0));
  const periodRevenue = sum(periodSales);
  const periodCogs = periodSales.reduce((total, item) => total.plus(String(item.cogsTotal)), new Decimal(0));
  const periodDiscounts = periodSales.reduce((total, sale) => total.plus(String(sale.discountTotal)), new Decimal(0));
  const periodRefunds = periodReturns.reduce((total, item) => total.plus(String(item.refundAmount)), new Decimal(0));
  const netRevenue = periodRevenue.minus(periodDiscounts).minus(periodRefunds);
  const periodItems = periodSales.reduce((total, sale) => total.plus(sale.items.reduce((sum, item) => sum.plus(String(item.quantity)), new Decimal(0))), new Decimal(0));
  const averageSale = periodSales.length ? periodRevenue.div(periodSales.length) : new Decimal(0);
  const servedCustomers = new Set(periodSales.map((sale) => sale.customerId).filter(Boolean)).size;
  const paymentTotals = new Map<string, Decimal>();
  for (const sale of periodSales) for (const payment of sale.payments) paymentTotals.set(payment.method, (paymentTotals.get(payment.method) ?? new Decimal(0)).plus(String(payment.amount)));
  const paymentTotal = [...paymentTotals.values()].reduce((total, value) => total.plus(value), new Decimal(0));
  const topProducts = new Map<string, Decimal>();
  for (const sale of periodSales) for (const item of sale.items) { const name = item.productNameSnapshot ?? "Unnamed product"; topProducts.set(name, (topProducts.get(name) ?? new Decimal(0)).plus(String(item.quantity))); }
  const topProductsList = [...topProducts.entries()].sort((a, b) => b[1].minus(a[1]).toNumber()).slice(0, 5);
  const hourlySales = Array.from({ length: 8 }, (_, index) => {
    const hour = new Date(startOfDay);
    hour.setHours(8 + index * 2);
    const nextHour = new Date(hour);
    nextHour.setHours(hour.getHours() + 2);
    return { label: hour.toLocaleTimeString("en-KE", { hour: "numeric" }), value: periodSales.filter((sale) => sale.createdAt >= hour && sale.createdAt < nextHour).reduce((total, sale) => total.plus(String(sale.total)), new Decimal(0)).toNumber() };
  });
  const chartColors = ["#0f7b6c", "#2563a6", "#8a5a00", "#b3261e", "#146c43"];
  const paymentSlices = [...paymentTotals.entries()].map(([label, value], index) => ({ label: label === "MPESA" ? "M-Pesa" : label.replace("_", " "), value: value.toNumber(), color: chartColors[index % chartColors.length] }));
  const stockValue = products.reduce((sum, product) => sum.plus(product.variants.reduce((variantSum, variant) => {
    return variantSum.plus(variant.inventoryItems.reduce((itemSum, item) => itemSum.plus(new Decimal(String(item.quantity)).times(String(item.batch?.unitCost ?? 0))), new Decimal(0)));
  }, new Decimal(0))), new Decimal(0));
  const lowStock = products.filter((product) => product.variants.some((variant) => {
    const quantity = variant.inventoryItems.reduce((total, item) => total.plus(String(item.quantity)), new Decimal(0));
    return quantity.gt(0) && (quantity.lessThanOrEqualTo(5) || quantity.lessThanOrEqualTo(String(variant.reorderLevel)));
  })).length;
  const outOfStock = products.filter((product) => product.variants.length > 0 && product.variants.every((variant) => variant.inventoryItems.reduce((total, item) => total.plus(String(item.quantity)), new Decimal(0)).isZero())).length;
  const previousRevenue = sum(previousSales);
  const percentChange = (current: Decimal, previous: Decimal) => previous.isZero() ? "New" : `${current.minus(previous).div(previous).times(100).toFixed(1)}%`;
  const branchCount = branches.length;
  const totalStockUnits = products.reduce((sum, product) => sum.plus(product.variants.reduce((variantSum, variant) => variantSum.plus(variant.inventoryItems.reduce((itemSum, item) => itemSum.plus(String(item.quantity)), new Decimal(0))), new Decimal(0))), new Decimal(0));
  const monthRevenue = periodRevenue;
  const todayItems = periodItems;
  const todayRefunds = periodRefunds;
  const formatMoney = (value: Decimal) => `KES ${value.toFixed(2)}`;

  return (
    <div className="dashboard-home space-y-6">
      <section className="dashboard-hero flex flex-col justify-between gap-6 rounded-[var(--radius-lg)] px-6 py-7 text-white shadow-[0_14px_30px_rgba(15,123,108,0.14)] sm:flex-row sm:items-end sm:px-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">{organization.name} · {branchId ? branches.find((branch) => branch.id === branchId)?.name : "All Branches"}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{greeting}, {ctx.userName}</h1>
          <p className="mt-2 text-sm text-white/75">{formattedDate}</p>
          <p className="mt-2 max-w-md text-sm text-white/75">Here&apos;s what&apos;s happening across your business today.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <form method="get" className="flex flex-wrap gap-2">
            <select name="branchId" defaultValue={branchId} className="h-10 rounded-[var(--radius-sm)] border border-white/25 bg-white/10 px-3 text-sm text-white">
              <option value="" className="text-foreground">All branches</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id} className="text-foreground">{branch.name}</option>)}
            </select>
            <select name="period" defaultValue={period} className="h-10 rounded-[var(--radius-sm)] border border-white/25 bg-white/10 px-3 text-sm text-white">
              <option value="today" className="text-foreground">Today</option>
              <option value="7d" className="text-foreground">Last 7 days</option>
              <option value="30d" className="text-foreground">Last 30 days</option>
            </select>
            <button className="h-10 rounded-[var(--radius-sm)] bg-white/15 px-3 text-sm font-semibold text-white hover:bg-white/25">Apply</button>
          </form>
          <Link href="/dashboard/pos" className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-white px-4 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5">
            <ShoppingCart size={16} /> Open POS <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Gross sales", value: formatMoney(periodRevenue), note: `${percentChange(periodRevenue, previousRevenue)} vs previous period`, icon: CircleDollarSign, cardTone: "metric-card-revenue", tone: "bg-primary-tint text-primary" },
          { label: "Net revenue", value: formatMoney(netRevenue), note: `${formatMoney(periodDiscounts)} discounts · ${formatMoney(periodRefunds)} refunds`, icon: ArrowUpRight, cardTone: "metric-card-profit", tone: "bg-info-tint text-info" },
          { label: "Gross profit", value: formatMoney(periodRevenue.minus(periodCogs)), note: `${periodRevenue.isZero() ? "0.0" : periodRevenue.minus(periodCogs).div(periodRevenue).times(100).toFixed(1)}% margin`, icon: ArrowUpRight, cardTone: "metric-card-profit", tone: "bg-success-tint text-success" },
          { label: "Transactions", value: String(periodSales.length), note: `${percentChange(new Decimal(periodSales.length), new Decimal(previousSales.length))} vs previous period`, icon: ShoppingCart, cardTone: "metric-card-customers", tone: "bg-primary-tint text-primary" },
        ].map((metric) => {
          const Icon = metric.icon;
          return <Card key={metric.label} className={`metric-card ${metric.cardTone}`}><CardContent className="flex items-start justify-between p-5"><div><p className="text-[12px] font-medium text-muted-foreground">{metric.label}</p><p className="mt-3 font-tabular text-2xl font-semibold tracking-tight">{metric.value}</p><p className="mt-1 text-[12px] text-muted-foreground">{metric.note}</p></div><span className={`grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] ${metric.tone}`}><Icon size={18} /></span></CardContent></Card>;
        })}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Items sold", value: todayItems.toFixed(0), note: `${periodSales.length} completed transactions`, icon: Boxes }, { label: "Average sale", value: formatMoney(averageSale), note: "Per transaction", icon: ArrowUpRight }, { label: "Stock value", value: formatMoney(stockValue), note: `${totalStockUnits.toFixed(0)} units on hand`, icon: Boxes }, { label: "Out of stock", value: String(outOfStock), note: `${lowStock} need restocking`, icon: CircleDollarSign }].map((metric) => { const Icon = metric.icon; return <Card key={metric.label}><CardContent className="p-4"><div className="flex items-center justify-between"><p className="text-[12px] text-muted-foreground">{metric.label}</p><Icon size={17} className="text-primary" /></div><p className="mt-3 font-tabular text-xl font-semibold">{metric.value}</p><p className="mt-1 text-[11px] text-muted-foreground">{metric.note}</p></CardContent></Card>; })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Register status</p><h2 className="mt-1 text-lg font-semibold">{currentSummary ? `${currentSummary.register} · Open` : "Register closed"}</h2><p className="mt-1 text-[12px] text-muted-foreground">{currentSummary ? `${currentSummary.cashier} · ${currentSummary.branch}` : "Open a register to start taking sales."}</p></div><span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold ${currentSummary ? "bg-success-tint text-success" : "bg-surface-muted text-muted-foreground"}`}><span className={`h-2 w-2 rounded-full ${currentSummary ? "bg-success" : "bg-muted-foreground"}`} />{currentSummary ? "OPEN" : "CLOSED"}</span></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3"><div><p className="text-[11px] text-muted-foreground">Opening cash</p><p className="mt-1 font-tabular font-semibold">{formatMoney(new Decimal(currentSummary?.openingCash ?? 0))}</p></div><div><p className="text-[11px] text-muted-foreground">Expected cash</p><p className="mt-1 font-tabular font-semibold">{formatMoney(new Decimal(currentSummary?.expectedCash ?? 0))}</p></div><div><p className="text-[11px] text-muted-foreground">Shift sales</p><p className="mt-1 font-tabular font-semibold">{formatMoney(new Decimal(currentSummary?.totalSales ?? 0))}</p></div></div>
            <div className="mt-5 flex flex-wrap gap-2"><Link href="/dashboard/pos" className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground"><ShoppingCart size={14} /> New sale</Link><Link href="/dashboard/pos" className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border px-3 py-2 text-[12px] font-semibold text-foreground hover:bg-surface-muted"><Clock3 size={14} /> View shift</Link></div>
          </CardContent>
        </Card>
        <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Payment mix</p><h2 className="mt-1 text-lg font-semibold">Today&apos;s payments</h2></div><CircleDollarSign size={19} className="text-primary" /></div><div className="mt-4 space-y-3">{PAYMENT_METHODS.filter((method) => paymentTotals.has(method)).map((method) => { const amount = paymentTotals.get(method) ?? new Decimal(0); const share = paymentTotal.isZero() ? 0 : amount.div(paymentTotal).times(100).toFixed(0); return <div key={method}><div className="flex justify-between text-[12px]"><span className="font-medium">{method === "MPESA" ? "M-Pesa" : method.replace("_", " ")}</span><span className="font-tabular text-muted-foreground">{formatMoney(amount)} · {share}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} /></div></div>; })}{paymentTotals.size === 0 && <p className="text-sm text-muted-foreground">No confirmed payments today.</p>}</div></CardContent></Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card><CardContent className="p-5"><div className="mb-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Sales activity</p><h2 className="mt-1 text-lg font-semibold">Today&apos;s revenue trend</h2></div><LineChart values={hourlySales.map((hour) => hour.value)} labels={hourlySales.map((hour) => hour.label)} valueLabel="Revenue by time" /></CardContent></Card>
        <Card><CardContent className="p-5"><div className="mb-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Sales comparison</p><h2 className="mt-1 text-lg font-semibold">Payment mix</h2></div><PieChart slices={paymentSlices} formatValue={(value) => formatMoney(new Decimal(value))} /></CardContent></Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Product performance</p><h2 className="mt-1 text-lg font-semibold">Top products today</h2></div><Link href="/dashboard/reports" className="text-[12px] font-semibold text-primary hover:underline">View reports</Link></div>{topProductsList.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No products sold today.</p> : <div className="mt-4 divide-y divide-border">{topProductsList.map(([name, quantity], index) => <div key={name} className="flex items-center justify-between gap-4 py-3 first:pt-0"><div className="flex min-w-0 items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-tint text-[11px] font-semibold text-primary">{String(index + 1).padStart(2, "0")}</span><span className="truncate text-sm font-medium">{name}</span></div><span className="shrink-0 font-tabular text-sm font-semibold">{quantity.toFixed(0)} sold</span></div>)}</div>}</CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-warning">Needs attention</p><h2 className="mt-1 text-lg font-semibold">Today&apos;s exceptions</h2></div><ArrowDownLeft size={19} className="text-warning" /></div><div className="mt-4 space-y-3"><div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-warning-tint px-3 py-2.5"><span className="text-[12px] font-medium">Stock alerts</span><Link href="/dashboard/inventory" className="text-sm font-semibold text-warning hover:underline">{lowStock} items</Link></div><div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-danger-tint px-3 py-2.5"><span className="text-[12px] font-medium">Refunds today</span><span className="font-tabular text-sm font-semibold text-danger">{formatMoney(todayRefunds)}</span></div><div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-primary-tint px-3 py-2.5"><span className="text-[12px] font-medium">Customers served</span><span className="font-tabular text-sm font-semibold text-primary">{servedCustomers}</span></div></div></CardContent></Card>
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
