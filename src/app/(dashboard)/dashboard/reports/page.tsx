import Decimal from "decimal.js";
import { requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, BarChart3, CalendarDays, Download, Filter, Printer } from "lucide-react";
import { getPreviousRange, resolveReportRange } from "@/lib/reports/range";
import { ExportLink } from "./export-link";

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const tabs = [
  "Overview",
  "Sales",
  "Products",
  "Inventory",
  "Payments",
  "Customers",
  "Purchases",
  "Expenses",
  "Profit & Loss",
  "Cashiers",
];

const toDecimal = (value: unknown) => new Decimal((value ?? 0).toString());
const money = (value: Decimal | number | string) =>
  currency.format(new Decimal(value.toString()).toNumber());
const percentDelta = (current: Decimal, previous: Decimal) => {
  if (previous.isZero()) return "0.0%";
  const delta = current.minus(previous).div(previous).times(100);
  return `${delta.toFixed(1)}%`;
};
const getInputDate = (value: Date) => value.toISOString().slice(0, 10);
const formatSaleLabel = (method: string) => {
  switch (method) {
    case "MPESA":
      return "M-Pesa";
    case "CARD":
      return "Card";
    case "BANK_TRANSFER":
      return "Bank Transfer";
    case "CREDIT":
      return "Credit";
    case "OTHER":
      return "Other";
    default:
      return "Cash";
  }
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const ctx = await requireAuthContext();
  const params = searchParams ? await searchParams : {};
  const activeRange = resolveReportRange(params.range, params.from, params.to);
  const rangeStart = activeRange.start;
  const rangeEnd = activeRange.end;
  const previousRange = getPreviousRange(rangeStart, rangeEnd);

  const [sales, previousSales, expenses, refunds, inventory, recentSales] = await Promise.all([
    ctx.db.sale.findMany({
      where: { status: "COMPLETED", createdAt: { gte: rangeStart, lte: rangeEnd } },
      include: {
        cashier: true,
        payments: true,
        items: {
          include: {
            variant: {
              include: { product: { include: { category: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    ctx.db.sale.findMany({
      where: { status: "COMPLETED", createdAt: { gte: previousRange.start, lte: previousRange.end } },
      select: { total: true, discountTotal: true, cogsTotal: true },
    }),
    ctx.db.expense.findMany({
      where: { incurredAt: { gte: rangeStart, lte: rangeEnd } },
      include: { category: true },
    }),
    ctx.db.saleReturn.findMany({
      where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
      select: { refundAmount: true },
    }),
    ctx.db.productVariant.findMany({
      where: { isActive: true, product: { isActive: true, organizationId: ctx.organizationId } },
      include: {
        product: { include: { category: true } },
        inventoryItems: { select: { quantity: true } },
      },
    }),
    ctx.db.sale.findMany({
      where: { status: "COMPLETED", createdAt: { gte: rangeStart, lte: rangeEnd } },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { cashier: true, payments: true },
    }),
  ]);

  const currentSalesTotal = sales.reduce((sum, sale) => sum.plus(toDecimal(sale.total)), new Decimal(0));
  const currentDiscounts = sales.reduce((sum, sale) => sum.plus(toDecimal(sale.discountTotal)), new Decimal(0));
  const currentCogs = sales.reduce((sum, sale) => sum.plus(toDecimal(sale.cogsTotal)), new Decimal(0));
  const currentRefunds = refunds.reduce((sum, refund) => sum.plus(toDecimal(refund.refundAmount)), new Decimal(0));
  const currentExpenses = expenses.reduce((sum, expense) => sum.plus(toDecimal(expense.amount)), new Decimal(0));
  const currentNetRevenue = currentSalesTotal.minus(currentDiscounts).minus(currentRefunds);
  const grossProfit = currentNetRevenue.minus(currentCogs);
  const estimatedProfit = grossProfit.minus(currentExpenses);
  const priorSalesTotal = previousSales.reduce((sum, sale) => sum.plus(toDecimal(sale.total)), new Decimal(0));
  const priorDiscounts = previousSales.reduce((sum, sale) => sum.plus(toDecimal(sale.discountTotal)), new Decimal(0));
  const priorCogs = previousSales.reduce((sum, sale) => sum.plus(toDecimal(sale.cogsTotal)), new Decimal(0));
  const priorNetRevenue = priorSalesTotal.minus(priorDiscounts);

  const topProducts = new Map<string, { name: string; units: Decimal; revenue: Decimal }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const productName = item.variant.product.name;
      const existing = topProducts.get(productName) ?? { name: productName, units: new Decimal(0), revenue: new Decimal(0) };
      existing.units = existing.units.plus(toDecimal(item.quantity));
      existing.revenue = existing.revenue.plus(toDecimal(item.total));
      topProducts.set(productName, existing);
    }
  }

  const topProductsList = [...topProducts.values()]
    .sort((a, b) => b.units.minus(a.units).toNumber())
    .slice(0, 5)
    .map((item) => ({
      name: item.name,
      units: Number(item.units.toFixed(0)),
      revenue: money(item.revenue),
    }));

  const paymentTotals = new Map<string, Decimal>();
  const paymentCounts = new Map<string, number>();
  for (const sale of sales) {
    for (const payment of sale.payments) {
      const method = formatSaleLabel(payment.method);
      paymentTotals.set(method, (paymentTotals.get(method) ?? new Decimal(0)).plus(toDecimal(payment.amount)));
      paymentCounts.set(method, (paymentCounts.get(method) ?? 0) + 1);
    }
  }
  const paymentMethods = [...paymentTotals.entries()]
    .sort((a, b) => b[1].minus(a[1]).toNumber())
    .map(([name, amount], index, rows) => {
      const total = rows.reduce((sum, [, value]) => sum.plus(value), new Decimal(0));
      const share = total.isZero() ? 0 : amount.div(total).times(100).toNumber();
      return { name, amount: amount.toNumber(), count: paymentCounts.get(name) ?? 0, share: Number(share.toFixed(1)) };
    });

  const categoryTotals = new Map<string, Decimal>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const categoryName = item.variant.product.category?.name ?? "Uncategorized";
      categoryTotals.set(categoryName, (categoryTotals.get(categoryName) ?? new Decimal(0)).plus(toDecimal(item.total)));
    }
  }
  const categoryPerformance = [...categoryTotals.entries()]
    .sort((a, b) => b[1].minus(a[1]).toNumber())
    .slice(0, 5)
    .map(([name, value]) => ({ name, value: value.toNumber() }));

  const cashierTotals = new Map<string, { orders: number; sales: Decimal; name: string }>();
  for (const sale of sales) {
    const current = cashierTotals.get(sale.cashier.name) ?? { orders: 0, sales: new Decimal(0), name: sale.cashier.name };
    current.orders += 1;
    current.sales = current.sales.plus(toDecimal(sale.total));
    cashierTotals.set(sale.cashier.name, current);
  }
  const cashierPerformance = [...cashierTotals.values()]
    .sort((a, b) => b.sales.minus(a.sales).toNumber())
    .slice(0, 3)
    .map((cashier) => ({
      name: cashier.name,
      orders: cashier.orders,
      sales: money(cashier.sales),
    }));

  const totalStockUnits = inventory.reduce((sum, variant) => sum.plus(
    variant.inventoryItems.reduce((s, item) => s.plus(toDecimal(item.quantity)), new Decimal(0))
  ), new Decimal(0));
  const lowStockRows = inventory
    .filter((variant) => {
      const quantity = variant.inventoryItems.reduce((sum, item) => sum.plus(toDecimal(item.quantity)), new Decimal(0));
      return quantity.lte(toDecimal(variant.reorderLevel));
    })
    .slice(0, 4)
    .map((variant) => ({
      name: variant.product.name,
      stock: Number(variant.inventoryItems.reduce((sum, item) => sum.plus(toDecimal(item.quantity)), new Decimal(0)).toFixed(0)),
      reorder: Number(toDecimal(variant.reorderLevel).toFixed(0)),
    }));

  const recentTransactions = recentSales.map((sale) => ({
    id: sale.receiptNumber,
    cashier: sale.cashier.name,
    payment: sale.payments[0] ? formatSaleLabel(sale.payments[0].method) : "Cash",
    amount: money(sale.total),
    status: sale.status,
  }));

  const chartValues = sales.length
    ? Array.from({ length: 7 }, (_, index) => {
        const day = new Date(rangeStart);
        day.setDate(rangeStart.getDate() + index);
        const value = sales
          .filter((sale) => sale.createdAt.toDateString() === day.toDateString())
          .reduce((sum, sale) => sum.plus(toDecimal(sale.total)), new Decimal(0));
        return value.isZero() ? 0 : value.toNumber();
      })
    : [0, 0, 0, 0, 0, 0, 0];
  const chartMax = Math.max(...chartValues, 1);

  const summaryCards = [
    { label: "Total sales", value: money(currentSalesTotal), change: `${percentDelta(currentSalesTotal, priorSalesTotal)} vs previous month` },
    { label: "Net revenue", value: money(currentNetRevenue), change: `${percentDelta(currentNetRevenue, priorNetRevenue)} vs previous month` },
    { label: "Transactions", value: sales.length.toString(), change: `${sales.length > 0 ? percentDelta(new Decimal(sales.length), new Decimal(previousSales.length || 0)) : "0.0%"} vs previous month` },
    { label: "Estimated profit", value: money(estimatedProfit), change: `${percentDelta(estimatedProfit, priorSalesTotal.minus(priorCogs).minus(currentExpenses))} vs previous month` },
  ];

  const rangeHref = (key: string) => {
    const search = new URLSearchParams();
    search.set("range", key);
    if (key === "custom") {
      search.set("from", getInputDate(rangeStart));
      search.set("to", getInputDate(rangeEnd));
    }
    return `/dashboard/reports?${search.toString()}`;
  };

  const customHref = () => {
    const search = new URLSearchParams();
    search.set("range", "custom");
    return `/dashboard/reports?${search.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports &amp; analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor sales, revenue, inventory, payments and business performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" className="gap-2">
            <Download size={15} /> Export report
          </Button>
          <Button type="button" variant="secondary" className="gap-2">
            <Printer size={15} /> Print
          </Button>
          <Button type="button" variant="secondary" className="gap-2">
            <BarChart3 size={15} /> More
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-muted px-2.5 py-2 text-sm font-medium">
              <CalendarDays size={15} className="text-muted-foreground" />
              <span>{activeRange.label}</span>
            </div>
            {[
              { label: "Today", key: "today" },
              { label: "This Week", key: "week" },
              { label: "This Month", key: "month" },
              { label: "Custom Range", key: "custom" },
            ].map((range) => (
              <a
                key={range.key}
                href={range.key === "custom" ? customHref() : rangeHref(range.key)}
                className={`rounded-md border px-2.5 py-2 text-sm transition ${
                  activeRange.key === range.key
                    ? "border-primary bg-primary-tint text-primary"
                    : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                {range.label}
              </a>
            ))}
          </div>

          <form method="GET" action="/dashboard/reports" className="grid gap-3 md:grid-cols-[1fr_1fr_140px] lg:grid-cols-[180px_180px_180px_1fr]">
            <input type="hidden" name="range" value="custom" />
            <label className="space-y-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">From</span>
              <input
                type="date"
                name="from"
                defaultValue={getInputDate(rangeStart)}
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">To</span>
              <input
                type="date"
                name="to"
                defaultValue={getInputDate(rangeEnd)}
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">Compare</span>
              <select className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground">
                <option>Previous period</option>
                <option>Previous year</option>
                <option>No comparison</option>
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" className="w-full gap-2">
                <Filter size={15} /> Apply filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              index === 0
                ? "border-primary bg-primary-tint text-primary"
                : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((metric) => (
          <Card key={metric.label} className="metric-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="mt-3 font-tabular text-2xl font-semibold tracking-tight">{metric.value}</p>
                </div>
                <Badge variant="primary" className="mt-1">
                  <ArrowUpRight size={12} className="mr-1" /> {metric.change}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4 pb-2">
            <div>
              <CardTitle>Sales performance</CardTitle>
              <CardDescription>Revenue and order totals for this reporting window</CardDescription>
            </div>
            <div className="flex gap-2">
              {['Revenue', 'Orders', 'Units sold'].map((item, index) => (
                <button
                  key={item}
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-[12px] ${
                    index === 0
                      ? "border-primary bg-primary-tint text-primary"
                      : "border-border bg-surface text-muted-foreground"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{money(currentSalesTotal)}</span>
                <span>Daily</span>
              </div>
              <div className="grid h-48 grid-cols-7 items-end gap-3">
                {chartValues.map((value, index) => (
                  <div key={index} className="flex h-full flex-col justify-end">
                    <div
                      className="mb-2 rounded-t-md bg-gradient-to-t from-primary to-primary/60"
                      style={{ height: `${Math.max((value / chartMax) * 100, 8)}%` }}
                    />
                    <span className="text-center text-[11px] text-muted-foreground">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gross sales</span>
                <span className="font-tabular font-medium">{money(currentSalesTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Discounts</span>
                <span className="font-tabular font-medium">{money(currentDiscounts)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Refunds</span>
                <span className="font-tabular font-medium">{money(currentRefunds)}</span>
              </div>
            </div>
            <div className="my-2 h-px bg-border" />
            <div className="flex items-center justify-between font-medium">
              <span>Net revenue</span>
              <span className="font-tabular">{money(currentNetRevenue)}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top selling products</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {topProductsList.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No completed sales in the selected period.</p>
              ) : (
                topProductsList.map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between rounded-md border border-border bg-surface-muted px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-tint text-[11px] font-semibold text-primary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-[12px] text-muted-foreground">{product.units} units</p>
                      </div>
                    </div>
                    <span className="font-tabular text-sm font-semibold">{product.revenue}</span>
                  </div>
                ))
              )}
            </div>
            <Button type="button" variant="link" className="mt-4 px-0 text-sm">
              View all products
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {paymentMethods.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No payment data for this period.</p>
              ) : (
                paymentMethods.map((method) => (
                  <div key={method.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{method.name}</span>
                      <span className="font-tabular">{money(method.amount)} <span className="text-[11px] text-muted-foreground">({method.count} tenders)</span></span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${method.share}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Category performance</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {categoryPerformance.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No category sales yet.</p>
              ) : (
                categoryPerformance.map((category) => (
                  <div key={category.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{category.name}</span>
                    <span className="font-tabular font-medium">{money(category.value)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cashier performance</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {cashierPerformance.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No cashier activity in this period.</p>
              ) : (
                cashierPerformance.map((cashier) => (
                  <div key={cashier.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm">
                    <span className="font-medium">{cashier.name}</span>
                    <span className="text-muted-foreground">{cashier.orders} orders</span>
                    <span className="font-tabular font-medium">{cashier.sales}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-surface-muted p-3"><p className="text-muted-foreground">Total stock</p><p className="mt-1 font-tabular font-semibold text-lg">{Number(totalStockUnits.toFixed(0)).toLocaleString()}</p></div>
                <div className="rounded-md bg-surface-muted p-3"><p className="text-muted-foreground">Low stock</p><p className="mt-1 font-tabular font-semibold text-lg">{lowStockRows.length}</p></div>
              </div>
              <div className="space-y-2 pt-2">
                {lowStockRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No low-stock items right now.</p>
                ) : (
                  lowStockRows.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="font-tabular text-muted-foreground">{item.stock} / {item.reorder}</span>
                    </div>
                  ))
                )}
              </div>
              <Button type="button" variant="link" className="mt-3 px-0 text-sm">
                View inventory
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Recent transactions</CardTitle>
            <CardDescription>Latest completed sales for the selected range</CardDescription>
          </div>
          <ExportLink from={getInputDate(rangeStart)} to={getInputDate(rangeEnd)} />
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Order</th>
                  <th className="py-3 pr-4 font-medium">Cashier</th>
                  <th className="py-3 pr-4 font-medium">Payment</th>
                  <th className="py-3 pr-4 font-medium">Amount</th>
                  <th className="py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      No completed sales in the selected period.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 font-medium">{transaction.id}</td>
                      <td className="py-3 pr-4">{transaction.cashier}</td>
                      <td className="py-3 pr-4">{transaction.payment}</td>
                      <td className="py-3 pr-4 font-tabular">{transaction.amount}</td>
                      <td className="py-3"><Badge variant="success">{transaction.status}</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
