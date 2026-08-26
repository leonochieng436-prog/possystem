"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import {
  requireAuthContext,
  assertPermission,
  assertBranchAccess,
  AuthError,
} from "@/server/auth/context";
import { recordAudit } from "@/server/services/audit";
import { adjustStockQuantity, InsufficientStockError } from "@/server/services/inventory";
import { adjustStockSchema } from "@/lib/validation/inventory";
import type { ActionResult } from "./auth";

export async function adjustStock(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "INVENTORY_ADJUST");

    const parsed = adjustStockSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Please fix the errors below.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    const input = parsed.data;

    const warehouse = await ctx.db.warehouse.findFirst({
      where: { id: input.warehouseId },
    });
    if (!warehouse) {
      return { ok: false, error: "Warehouse not found." };
    }
    assertBranchAccess(ctx, warehouse.branchId);

    const variant = await ctx.db.productVariant.findFirst({
      where: { id: input.variantId, product: { organizationId: ctx.organizationId } },
    });
    if (!variant) {
      return { ok: false, error: "Product not found." };
    }

    const signedDelta =
      input.direction === "INCREASE" ? Number(input.quantity) : -Number(input.quantity);

    try {
      await ctx.db.$transaction(async (tx) => {
        await adjustStockQuantity(tx as unknown as Prisma.TransactionClient, {
          organizationId: ctx.organizationId,
          warehouseId: input.warehouseId,
          variantId: input.variantId,
          delta: signedDelta,
          unitCostForIncrease:
            input.direction === "INCREASE"
              ? input.unitCost || variant.costPrice.toString()
              : undefined,
          type: input.type,
          reason: input.reason || undefined,
          createdById: ctx.userId,
        });
      });
    } catch (e) {
      if (e instanceof InsufficientStockError) {
        return {
          ok: false,
          error: `Not enough stock to remove — short by ${e.shortfall.toString()}.`,
        };
      }
      throw e;
    }

    await recordAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "INVENTORY_ADJUSTED",
      entityType: "ProductVariant",
      entityId: input.variantId,
      metadata: {
        warehouseId: input.warehouseId,
        direction: input.direction,
        quantity: input.quantity,
        type: input.type,
        reason: input.reason,
      },
    });

    revalidatePath("/dashboard/inventory");
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}
