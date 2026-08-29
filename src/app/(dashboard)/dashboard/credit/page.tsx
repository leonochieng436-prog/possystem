import { assertPermission, requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Decimal from "decimal.js";
import { AlertTriangle, CircleDollarSign, CreditCard, Users } from "lucide-react";
import { ClearCustomerBalanceForm } from "@/app/(dashboard)/dashboard/customers/customer-form";

const money = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2,
});

export default async function CreditPage() {
  const ctx = await requireAuthContext();
  assertPermission(ctx, "CUSTOMER_CREDIT_MANAGE");

  const [customers, sales] = await Promise.all([
    ctx.db.customer.findMany({
      where: { isWalkIn: false },
      include: {
        sales: {
          where: { isCreditSale: true, status: "COMPLETED" },
          select: { id: true, receiptNumber: true, total: true, amountPaid: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        payments: { select: { amount: true } },
      },
      orderBy: { name: "asc" },
    }),
    ctx.db.sale.findMany({
      where: { isCreditSale: true, status: "COMPLETED" },
      include: { customer: true, branch: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const customerSummary = customers
    .map((customer) => {
      const creditSales = customer.sales;
      const credit = creditSales.reduce(
        (sum, sale) => sum.plus(new Decimal(sale.total.toString()).minus(new Decimal(sale.amountPaid.toString()))),
        new Decimal(0),
      );
      const payments = customer.payments.reduce(
        (sum, payment) => sum.plus(new Decimal(payment.amount.toString())),
        new Decimal(0),
      );
      const balance = credit.minus(payments);

      return {
        customer,
        sales: creditSales,
        balance,
      };
    })
    .filter((item) => item.balance.gt(0));

  const totalOutstanding = customerSummary.reduce(
    (sum, item) => sum.plus(item.balance),
    new Decimal(0),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Accounts receivable</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Credit sales</h1>
          <p className="mt-2 text-sm text-muted-foreground">Review customer credit, outstanding balances, and clear any settled clients.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-muted-foreground">Outstanding balances</p>
              <Users size={17} className="text-primary" />
            </div>
            <p className="mt-4 text-xl font-semibold font-tabular">{customerSummary.length}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Customers with open credit</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-muted-foreground">Total receivables</p>
              <CircleDollarSign size={17} className="text-primary" />
            </div>
            <p className="mt-4 text-xl font-semibold font-tabular">{money.format(totalOutstanding.toNumber())}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Across all verified credit sales</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-muted-foreground">Credit sales</p>
              <CreditCard size={17} className="text-primary" />
            </div>
            <p className="mt-4 text-xl font-semibold font-tabular">{sales.length}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Completed credit transactions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Open customer balances</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {customerSummary.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground">No customers currently have an outstanding credit balance.</p>
            ) : (
              <div className="divide-y divide-border">
                {customerSummary.map(({ customer, balance, sales }) => (
                  <div key={customer.id} className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold">{customer.name}</p>
                        <Badge variant="warning">{sales.length} sale{sales.length === 1 ? "" : "s"}</Badge>
                      </div>
                      <p className="mt-1 text-[12px] text-muted-foreground">Limit: {money.format(Number(customer.creditLimit))} · Phone: {customer.phone ?? "—"}</p>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Outstanding</p>
                        <p className="font-tabular text-lg font-semibold">{money.format(balance.toNumber())}</p>
                      </div>
                      <ClearCustomerBalanceForm customerId={customer.id} customerName={customer.name} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent credit sales</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {sales.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground">There are no credit sales recorded yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {sales.map((sale) => {
                  const outstanding = new Decimal(sale.total.toString()).minus(new Decimal(sale.amountPaid.toString()));
                  return (
                    <div key={sale.id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold">{sale.customer?.name ?? "Walk-in credit"}</p>
                          <p className="text-[12px] text-muted-foreground">{sale.receiptNumber} · {sale.branch?.name ?? "Branch"}</p>
                        </div>
                        <Badge variant={outstanding.gt(0) ? "warning" : "success"}>{outstanding.gt(0) ? "Open" : "Cleared"}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-[12px] text-muted-foreground sm:grid-cols-3">
                        <span>Total: <span className="font-medium text-foreground">{money.format(Number(sale.total))}</span></span>
                        <span>Paid: <span className="font-medium text-foreground">{money.format(Number(sale.amountPaid))}</span></span>
                        <span>Due: <span className="font-medium text-foreground">{money.format(outstanding.toNumber())}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {customerSummary.some((item) => item.balance.gt(0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-warning" />
              Attention needed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">The total outstanding customer credit is <span className="font-semibold text-foreground">{money.format(totalOutstanding.toNumber())}</span>. Clear balances as customers settle their accounts.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
