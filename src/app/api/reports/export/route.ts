import { NextResponse } from "next/server";
import { requireAuthContext } from "@/server/auth/context";

export async function GET(request: Request) {
  const ctx = await requireAuthContext();
  const url = new URL(request.url);
  const from = new Date(url.searchParams.get("from") ?? new Date().toISOString());
  const to = new Date(url.searchParams.get("to") ?? new Date().toISOString());
  to.setDate(to.getDate() + 1);
  const [sales, expenses] = await Promise.all([
    ctx.db.sale.findMany({ where: { organizationId: ctx.organizationId, createdAt: { gte: from, lt: to } }, select: { receiptNumber: true, status: true, total: true, cogsTotal: true, createdAt: true } }),
    ctx.db.expense.findMany({ where: { organizationId: ctx.organizationId, incurredAt: { gte: from, lt: to } }, select: { description: true, paymentMethod: true, amount: true, incurredAt: true } }),
  ]);
  const rows = ["type,reference,status,amount,cogs,date", ...sales.map((sale) => `sale,${sale.receiptNumber},${sale.status},${sale.total.toString()},${sale.cogsTotal.toString()},${sale.createdAt.toISOString()}`), ...expenses.map((expense) => `expense,${expense.description ?? ""},,${expense.amount.toString()},,${expense.incurredAt.toISOString()}`)];
  return new NextResponse(rows.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=dukaos-report.csv" } });
}
