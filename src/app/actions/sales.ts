"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";
import { requireAuthContext, assertPermission, assertBranchAccess, AuthError } from "@/server/auth/context";
import { decreaseStock } from "@/server/services/inventory";
import { recordAudit } from "@/server/services/audit";
import { saleSchema, cashSessionSchema, closeCashSessionSchema } from "@/lib/validation/sales";
import { z } from "zod";
import type { ActionResult } from "./auth";
import { getRegisterSummary } from "@/server/services/register-summary";

export async function openCashSession(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext(); assertPermission(ctx, "CASH_SESSION_OPEN");
    const parsed = cashSessionSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: "Enter a valid opening balance." };
    const input = parsed.data; assertBranchAccess(ctx, input.branchId);
    const register = await ctx.db.register.findFirst({ where: { id: input.registerId, branchId: input.branchId, branch: { organizationId: ctx.organizationId }, isActive: true } });
    if (!register) return { ok: false, error: "Register not found." };
    const open = await ctx.db.cashSession.findFirst({ where: { registerId: register.id, status: "OPEN" } });
    if (open) return { ok: false, error: "This register already has an open session." };
    await ctx.db.cashSession.create({ data: { organizationId: ctx.organizationId, branchId: input.branchId, registerId: register.id, userId: ctx.userId, openingBalance: input.openingBalance } });
    revalidatePath("/dashboard/pos"); return { ok: true, data: undefined };
  } catch (e) { if (e instanceof AuthError) return { ok: false, error: e.message }; throw e; }
}

export async function createSale(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuthContext(); assertPermission(ctx, "SALES_CREATE");
    const parsed = saleSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: "Add products and choose a payment method.", fieldErrors: parsed.error.flatten().fieldErrors };
    const input = parsed.data; assertBranchAccess(ctx, input.branchId);
    const payments = input.payments?.length ? input.payments : [{ method: input.paymentMethod, amount: input.amountPaid }];
    const paymentTotal = payments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0));
    if (payments.some((payment) => payment.method === "CREDIT") && !input.customerId) return { ok: false, error: "Select a customer for credit sales." };
    const branch = await ctx.db.branch.findFirst({ where: { id: input.branchId, isActive: true } });
    const register = await ctx.db.register.findFirst({ where: { id: input.registerId, branchId: input.branchId, branch: { organizationId: ctx.organizationId }, isActive: true } });
    const warehouse = await ctx.db.warehouse.findFirst({ where: { id: input.warehouseId, branchId: input.branchId, isActive: true } });
    if (!branch || !register || !warehouse) return { ok: false, error: "Branch, register, or warehouse not found." };
    if (input.customerId && !(await ctx.db.customer.findFirst({ where: { id: input.customerId } }))) return { ok: false, error: "Customer not found." };
    const variants = await ctx.db.productVariant.findMany({ where: { id: { in: input.items.map((item) => item.variantId) }, isActive: true, product: { isActive: true, organizationId: ctx.organizationId } }, include: { product: true } });
    if (variants.length !== input.items.length) return { ok: false, error: "One or more products were not found." };
    const lines = input.items.map((item) => { const variant = variants.find((candidate) => candidate.id === item.variantId)!; const quantity = new Decimal(item.quantity); const price = new Decimal(variant.sellingPrice.toString()); return { ...item, quantity, price, total: quantity.times(price), variant }; });
    const subtotal = lines.reduce((sum, line) => sum.plus(line.total), new Decimal(0));
    const sale = await ctx.db.$transaction(async (tx) => {
      let cogs = new Decimal(0);
      const saleItems = [];
      for (const line of lines) {
        const consumed = await decreaseStock(tx as unknown as Prisma.TransactionClient, { organizationId: ctx.organizationId, warehouseId: warehouse.id, variantId: line.variantId, quantity: line.quantity, type: "SALE", referenceType: "Sale", createdById: ctx.userId });
        const unitCost = consumed.totalConsumed.isZero() ? new Decimal(0) : consumed.totalCost.div(consumed.totalConsumed);
        cogs = cogs.plus(consumed.totalCost);
        saleItems.push({ variantId: line.variantId, productNameSnapshot: line.variant.product.name, variantNameSnapshot: line.variant.name, skuSnapshot: line.variant.sku, quantity: line.quantity.toString(), unitPrice: line.price.toString(), unitCost: unitCost.toString(), total: line.total.toString() });
      }
      const amountPaid = paymentTotal; if (amountPaid.lessThan(subtotal) && !payments.some((payment) => payment.method === "CREDIT")) throw new Error("Payment is less than the sale total.");
      if (input.customerId && payments.some((payment) => payment.method === "CREDIT")) {
        const customer = await tx.customer.findFirst({ where: { id: input.customerId, organizationId: ctx.organizationId } });
        if (!customer) throw new Error("Customer not found.");
        const existingCredit = await tx.sale.aggregate({ where: { customerId: customer.id, isCreditSale: true, status: "COMPLETED" }, _sum: { total: true, amountPaid: true } });
        const outstanding = new Decimal(existingCredit._sum.total?.toString() ?? 0).minus(existingCredit._sum.amountPaid?.toString() ?? 0);
        if (outstanding.plus(subtotal.minus(amountPaid)).greaterThan(customer.creditLimit.toString())) throw new Error("This sale would exceed the customer's credit limit.");
      }
      const session = await tx.cashSession.findFirst({ where: { registerId: register.id, branchId: branch.id, organizationId: ctx.organizationId, status: "OPEN" } });
      if (!session) throw new Error("Open the register before completing a sale.");
      const created = await tx.sale.create({ data: { organizationId: ctx.organizationId, branchId: branch.id, registerId: register.id, cashierId: ctx.userId, cashSessionId: session?.id, receiptNumber: `R-${Date.now()}`, subtotal: subtotal.toFixed(2), total: subtotal.toFixed(2), cogsTotal: cogs.toFixed(2), amountPaid: amountPaid.toFixed(2), changeGiven: Decimal.max(amountPaid.minus(subtotal), 0).toFixed(2), isCreditSale: payments.some((payment) => payment.method === "CREDIT"), customerId: input.customerId || null, items: { create: saleItems }, payments: { create: payments.map((payment) => ({ organizationId: ctx.organizationId, method: payment.method, amount: payment.amount })) } } });
      const cashPaid = payments.filter((payment) => payment.method === "CASH").reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0));
      if (session && cashPaid.gt(0)) await tx.cashMovement.create({ data: { cashSessionId: session.id, type: "SALE", amount: Decimal.max(cashPaid.minus(Decimal.max(amountPaid.minus(subtotal), 0)), 0).toFixed(2), referenceType: "Sale", referenceId: created.id } });
      return created;
    }, { maxWait: 10000, timeout: 15000 });
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "SALE_CREATED", entityType: "Sale", entityId: sale.id, metadata: { total: subtotal.toFixed(2) } });
    revalidatePath("/dashboard/pos"); revalidatePath("/dashboard"); revalidatePath("/dashboard/reports"); revalidatePath("/dashboard/inventory"); return { ok: true, data: { id: sale.id } };
  } catch (e) { if (e instanceof AuthError) return { ok: false, error: e.message }; return { ok: false, error: e instanceof Error ? e.message : "Could not complete sale." }; }
}

export async function closeCashSession(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext(); assertPermission(ctx, "CASH_SESSION_CLOSE");
    const parsed = closeCashSessionSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: "Enter the actual cash balance." };
    const input = parsed.data; const session = await ctx.db.cashSession.findFirst({ where: { id: input.sessionId, status: "OPEN" } });
    if (!session) return { ok: false, error: "Open cash session not found." };
    if (ctx.branchIds && !ctx.branchIds.includes(session.branchId)) return { ok: false, error: "You do not have access to this register." };
    const summary = await getRegisterSummary(ctx.db, session.id);
    if (!summary) return { ok: false, error: "Open cash session not found." };
    const expected = new Decimal(summary.expectedCash);
    const actual = new Decimal(input.actualBalance);
    await ctx.db.cashSession.update({ where: { id: session.id }, data: { status: "CLOSED", expectedBalance: expected.toFixed(2), actualBalance: actual.toFixed(2), variance: actual.minus(expected).toFixed(2), closedAt: new Date() } });
    revalidatePath("/dashboard/pos"); revalidatePath("/dashboard"); revalidatePath("/dashboard/reports"); return { ok: true, data: undefined };
  } catch (e) { if (e instanceof AuthError) return { ok: false, error: e.message }; throw e; }
}

export async function updateReceiptNotes(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "SALES_VIEW");
    const parsed = z.object({ saleId: z.string().min(1), notes: z.string().max(300) }).safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Receipt note is too long." };
    const sale = await ctx.db.sale.findFirst({ where: { id: parsed.data.saleId, organizationId: ctx.organizationId, status: "COMPLETED" } });
    if (!sale) return { ok: false, error: "Receipt not found." };
    await ctx.db.sale.update({ where: { id: sale.id }, data: { notes: parsed.data.notes || null } });
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "RECEIPT_NOTE_UPDATED", entityType: "Sale", entityId: sale.id });
    revalidatePath("/dashboard/pos"); revalidatePath(`/dashboard/pos/receipts/${sale.id}`);
    return { ok: true, data: undefined };
  } catch (e) { if (e instanceof AuthError) return { ok: false, error: e.message }; throw e; }
}
