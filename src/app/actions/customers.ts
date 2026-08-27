"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";
import { requireAuthContext, assertPermission, AuthError } from "@/server/auth/context";
import { increaseStock } from "@/server/services/inventory";
import { recordAudit } from "@/server/services/audit";
import { customerSchema, customerPaymentSchema, returnSchema } from "@/lib/validation/customers";
import type { ActionResult } from "./auth";

export async function createCustomer(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuthContext(); assertPermission(ctx, "CUSTOMERS_MANAGE");
    const parsed = customerSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid customer." };
    const input = parsed.data;
    const customer = await ctx.db.customer.create({ data: { organizationId: ctx.organizationId, name: input.name, phone: input.phone || null, email: input.email || null, address: input.address || null, category: input.category, creditLimit: input.creditLimit, notes: input.notes || null } });
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "CUSTOMER_CREATED", entityType: "Customer", entityId: customer.id, metadata: { name: customer.name } });
    revalidatePath("/dashboard/customers"); return { ok: true, data: { id: customer.id } };
  } catch (e) { if (e instanceof AuthError) return { ok: false, error: e.message }; throw e; }
}

export async function recordCustomerPayment(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext(); assertPermission(ctx, "CUSTOMER_CREDIT_MANAGE");
    const parsed = customerPaymentSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment." };
    const input = parsed.data; const customer = await ctx.db.customer.findFirst({ where: { id: input.customerId } });
    if (!customer) return { ok: false, error: "Customer not found." };
    const creditSales = await ctx.db.sale.findMany({ where: { customerId: customer.id, isCreditSale: true, status: "COMPLETED" }, select: { total: true, amountPaid: true } });
    const balance = creditSales.reduce((sum, sale) => sum.plus(sale.total.toString()).minus(sale.amountPaid.toString()), new Decimal(0));
    const payments = await ctx.db.customerPayment.findMany({ where: { customerId: customer.id }, select: { amount: true } });
    const outstanding = balance.minus(payments.reduce((sum, payment) => sum.plus(payment.amount.toString()), new Decimal(0)));
    const amount = new Decimal(input.amount); if (amount.greaterThan(outstanding)) return { ok: false, error: "Payment cannot exceed the outstanding balance." };
    await ctx.db.customerPayment.create({ data: { organizationId: ctx.organizationId, customerId: customer.id, amount: input.amount, method: input.method, reference: input.reference || null, receivedById: ctx.userId } });
    revalidatePath("/dashboard/customers"); return { ok: true, data: undefined };
  } catch (e) { if (e instanceof AuthError) return { ok: false, error: e.message }; throw e; }
}

export async function createSaleReturn(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext(); assertPermission(ctx, "SALES_REFUND");
    const parsed = returnSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: "Add at least one returned item." };
    const input = parsed.data; const sale = await ctx.db.sale.findFirst({ where: { id: input.saleId, organizationId: ctx.organizationId, status: "COMPLETED" }, include: { items: true } });
    if (!sale) return { ok: false, error: "Completed sale not found." };
    const warehouse = await ctx.db.warehouse.findFirst({ where: { branchId: sale.branchId, isActive: true } }); if (!warehouse) return { ok: false, error: "No active warehouse for this branch." };
    await ctx.db.$transaction(async (tx) => {
      let refund = new Decimal(0);
      const returnItems = [];
      for (const inputItem of input.items) {
        const saleItem = sale.items.find((item) => item.id === inputItem.saleItemId); if (!saleItem) throw new Error("Sale item not found.");
        const quantity = new Decimal(inputItem.quantity); if (quantity.greaterThan(saleItem.quantity.toString())) throw new Error("Return quantity exceeds the sold quantity.");
        const amount = quantity.times(saleItem.unitPrice.toString()); refund = refund.plus(amount); returnItems.push({ saleItemId: saleItem.id, quantity: quantity.toString(), refundAmount: amount.toFixed(2) });
        await increaseStock(tx as unknown as Prisma.TransactionClient, { organizationId: ctx.organizationId, warehouseId: warehouse.id, variantId: saleItem.variantId, quantity, unitCost: saleItem.unitCost, type: "SALE_RETURN", referenceType: "SaleReturn", referenceId: input.saleId, createdById: ctx.userId });
      }
      await tx.saleReturn.create({ data: { organizationId: ctx.organizationId, saleId: sale.id, customerId: sale.customerId, status: "COMPLETED", reason: input.reason || null, refundMethod: input.refundMethod, refundAmount: refund.toFixed(2), requestedById: ctx.userId, approvedById: ctx.userId, items: { create: returnItems } } });
    });
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "SALE_RETURNED", entityType: "Sale", entityId: sale.id, metadata: { itemCount: input.items.length } });
    revalidatePath("/dashboard/pos"); revalidatePath("/dashboard/inventory"); revalidatePath("/dashboard/customers"); return { ok: true, data: undefined };
  } catch (e) { if (e instanceof AuthError) return { ok: false, error: e.message }; return { ok: false, error: e instanceof Error ? e.message : "Could not process return." }; }
}
