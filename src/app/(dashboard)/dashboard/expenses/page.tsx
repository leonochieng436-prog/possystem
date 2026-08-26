import { requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseForm } from "./expense-form";

export default async function ExpensesPage() {
  const ctx = await requireAuthContext();
  const [categories, branches, expenses] = await Promise.all([ctx.db.expenseCategory.findMany({ orderBy: { name: "asc" } }), ctx.db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }), ctx.db.expense.findMany({ include: { category: true, branch: true }, orderBy: { incurredAt: "desc" }, take: 50 })]);
  return <div className="space-y-6"><div><h1 className="text-lg font-semibold">Expenses</h1><p className="text-sm text-muted-foreground">Record operating expenses for financial reporting.</p></div><Card><CardHeader><CardTitle>Record expense</CardTitle></CardHeader><CardContent><ExpenseForm categories={categories.map((item) => ({ id: item.id, name: item.name }))} branches={branches.map((item) => ({ id: item.id, name: item.name }))} /></CardContent></Card><Card><CardHeader><CardTitle>Recent expenses</CardTitle></CardHeader><CardContent><div className="divide-y divide-border">{expenses.map((expense) => <div key={expense.id} className="flex justify-between py-2 text-sm"><span>{expense.description} <span className="text-muted-foreground">{expense.category.name}</span></span><span className="font-tabular">KES {expense.amount.toString()}</span></div>)}</div></CardContent></Card></div>;
}
