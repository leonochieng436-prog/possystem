"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext, assertPermission, assertBranchAccess, AuthError } from "@/server/auth/context";
import { recordAudit } from "@/server/services/audit";
import { expenseSchema } from "@/lib/validation/expenses";
import type { ActionResult } from "./auth";

export async function createExpense(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuthContext(); assertPermission(ctx, "EXPENSE_CREATE");
    const parsed = expenseSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid expense." };
    const input = parsed.data;
    if (input.branchId) assertBranchAccess(ctx, input.branchId);
    const category = await ctx.db.expenseCategory.findFirst({ where: { id: input.categoryId } }); if (!category) return { ok: false, error: "Expense category not found." };
    const expense = await ctx.db.expense.create({ data: { organizationId: ctx.organizationId, categoryId: category.id, branchId: input.branchId || null, amount: input.amount, paymentMethod: input.paymentMethod, description: input.description, incurredAt: input.incurredAt ? new Date(input.incurredAt) : new Date(), createdById: ctx.userId } });
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "EXPENSE_CREATED", entityType: "Expense", entityId: expense.id, metadata: { amount: input.amount } });
    revalidatePath("/dashboard/expenses"); revalidatePath("/dashboard/reports"); return { ok: true, data: { id: expense.id } };
  } catch (e) { if (e instanceof AuthError) return { ok: false, error: e.message }; throw e; }
}
