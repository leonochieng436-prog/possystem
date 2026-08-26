import { requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Decimal from "decimal.js";
import { ExportLink } from "./export-link";

export default async function ReportsPage() {
  const ctx = await requireAuthContext();
  const from = new Date(); from.setHours(0, 0, 0, 0); const to = new Date(); to.setDate(to.getDate() + 1); to.setHours(0, 0, 0, 0);
  const [sales, expenses, movements] = await Promise.all([ctx.db.sale.findMany({ where: { status: "COMPLETED", createdAt: { gte: from, lt: to } }, select: { total: true, cogsTotal: true, amountPaid: true } }), ctx.db.expense.findMany({ where: { incurredAt: { gte: from, lt: to } }, select: { amount: true } }), ctx.db.cashMovement.findMany({ where: { createdAt: { gte: from, lt: to }, type: { in: ["SALE", "REFUND", "DEPOSIT", "WITHDRAWAL"] } }, select: { amount: true, type: true } })]);
  const revenue = sales.reduce((sum, sale) => sum.plus(sale.total.toString()), new Decimal(0)); const cogs = sales.reduce((sum, sale) => sum.plus(sale.cogsTotal.toString()), new Decimal(0)); const operatingExpenses = expenses.reduce((sum, expense) => sum.plus(expense.amount.toString()), new Decimal(0)); const grossProfit = revenue.minus(cogs); const netProfit = grossProfit.minus(operatingExpenses); const cashFlow = movements.reduce((sum, movement) => sum.plus(movement.amount.toString()), new Decimal(0));
  const metric = (label: string, value: Decimal) => <div className="border-b border-border py-3 last:border-0"><p className="text-sm text-muted-foreground">{label}</p><p className="font-tabular text-xl font-semibold">KES {value.toFixed(2)}</p></div>;
  const date = from.toISOString().slice(0, 10);
  return <div className="space-y-6"><div className="flex items-end justify-between"><div><h1 className="text-lg font-semibold">Reports & analytics</h1><p className="text-sm text-muted-foreground">Today&apos;s ledger-derived financial summary.</p></div><ExportLink from={date} to={date} /></div><Card><CardHeader><CardTitle>Financial summary</CardTitle></CardHeader><CardContent>{metric("Revenue", revenue)}{metric("COGS", cogs)}{metric("Gross profit", grossProfit)}{metric("Operating expenses", operatingExpenses)}{metric("Net profit", netProfit)}{metric("Cash flow movements", cashFlow)}</CardContent></Card></div>;
}
