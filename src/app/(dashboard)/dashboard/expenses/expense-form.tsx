"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExpense } from "@/app/actions/expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Option = { id: string; name: string };
export function ExpenseForm({ categories, branches }: { categories: Option[]; branches: Option[] }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  function submit(formData: FormData) { startTransition(async () => { const result = await createExpense(Object.fromEntries(formData.entries())); if (result.ok) { (document.getElementById("expense-form") as HTMLFormElement)?.reset(); router.refresh(); } }); }
  return <form id="expense-form" action={submit} className="grid gap-2 sm:grid-cols-3"><select name="categoryId" required className="h-9 rounded border border-border-strong bg-surface px-2 text-sm"><option value="">Category...</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="branchId" className="h-9 rounded border border-border-strong bg-surface px-2 text-sm"><option value="">All branches</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount" required /><Input name="description" placeholder="Description" required /><Input name="incurredAt" type="date" /><select name="paymentMethod" defaultValue="cash" className="h-9 rounded border border-border-strong bg-surface px-2 text-sm"><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank</option><option value="card">Card</option><option value="other">Other</option></select><Button type="submit" disabled={pending}>{pending ? "Saving..." : "Record expense"}</Button></form>;
}
