"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";
import { requireAuthContext, assertPermission, assertBranchAccess, AuthError } from "@/server/auth/context";
import { decreaseStock, increaseStock } from "@/server/services/inventory";
import { recordAudit } from "@/server/services/audit";
import { transferSchema } from "@/lib/validation/transfers";
import type { ActionResult } from "./auth";

export async function createStockTransfer(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext(); assertPermission(ctx, "INVENTORY_TRANSFER");
    const parsed = transferSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid transfer." };
    const input = parsed.data; assertBranchAccess(ctx, input.fromBranchId); assertBranchAccess(ctx, input.toBranchId);
    const [source, destination] = await Promise.all([ctx.db.warehouse.findFirst({ where: { id: input.fromWarehouseId, branchId: input.fromBranchId, isActive: true } }), ctx.db.warehouse.findFirst({ where: { id: input.toWarehouseId, branchId: input.toBranchId, isActive: true } })]);
    if (!source || !destination) return { ok: false, error: "Source or destination warehouse not found." };
    const variants = await ctx.db.productVariant.findMany({ where: { id: { in: input.items.map((item) => item.variantId) }, isActive: true, product: { isActive: true } } });
    if (variants.length !== input.items.length) return { ok: false, error: "One or more products were not found." };
    await ctx.db.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({ data: { organizationId: ctx.organizationId, fromBranchId: source.branchId, toBranchId: destination.branchId, fromWarehouseId: source.id, toWarehouseId: destination.id, status: "COMPLETED", createdById: ctx.userId, items: { create: input.items } } });
      for (const item of input.items) {
        const result = await decreaseStock(tx as unknown as Prisma.TransactionClient, { organizationId: ctx.organizationId, warehouseId: source.id, variantId: item.variantId, quantity: item.quantity, type: "TRANSFER_OUT", referenceType: "StockTransfer", referenceId: transfer.id, createdById: ctx.userId });
        const unitCost = result.totalConsumed.isZero() ? new Decimal(0) : result.totalCost.div(result.totalConsumed);
        await increaseStock(tx as unknown as Prisma.TransactionClient, { organizationId: ctx.organizationId, warehouseId: destination.id, variantId: item.variantId, quantity: item.quantity, unitCost, type: "TRANSFER_IN", referenceType: "StockTransfer", referenceId: transfer.id, createdById: ctx.userId });
      }
    });
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "STOCK_TRANSFER_COMPLETED", entityType: "StockTransfer", metadata: { fromWarehouseId: source.id, toWarehouseId: destination.id } });
    revalidatePath("/dashboard/inventory"); revalidatePath("/dashboard/transfers"); return { ok: true, data: undefined };
  } catch (e) { if (e instanceof AuthError) return { ok: false, error: e.message }; return { ok: false, error: e instanceof Error ? e.message : "Could not complete transfer." }; }
}
