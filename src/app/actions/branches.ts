"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext, assertPermission, assertOwner, AuthError } from "@/server/auth/context";
import { recordAudit } from "@/server/services/audit";
import { createBranchSchema } from "@/lib/validation/auth";
import type { ActionResult } from "./auth";

export async function createBranch(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "BRANCHES_MANAGE");
    assertOwner(ctx);

    const parsed = createBranchSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please fix the errors below.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    const input = parsed.data;

    const existing = await ctx.db.branch.findFirst({
      where: { code: input.code.toUpperCase() },
    });
    if (existing) {
      return {
        ok: false,
        error: "A branch with this code already exists.",
        fieldErrors: { code: ["Already in use"] },
      };
    }

    const branch = await ctx.db.branch.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        code: input.code.toUpperCase(),
        address: input.address || null,
        phone: input.phone || null,
      },
    });

    // Every new branch gets a default warehouse and POS register so it's
    // immediately usable — an empty branch with nowhere to hold stock or
    // ring up a sale isn't a complete feature.
    const warehouse = await ctx.db.warehouse.create({
      data: {
        branchId: branch.id,
        organizationId: ctx.organizationId,
        name: `${branch.name} Warehouse`,
        isDefault: true,
      },
    });

    await ctx.db.register.create({
      data: { branchId: branch.id, name: "Register 1" },
    });

    await recordAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "BRANCH_CREATED",
      entityType: "Branch",
      entityId: branch.id,
      metadata: { name: branch.name, code: branch.code, warehouseId: warehouse.id },
    });

    revalidatePath("/dashboard/settings/branches");
    return { ok: true, data: { id: branch.id } };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updateBranch(branchId: string, raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "BRANCHES_MANAGE");
    assertOwner(ctx);
    const parsed = createBranchSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Please fix the branch details." };
    const input = parsed.data;
    const existing = await ctx.db.branch.findFirst({ where: { code: input.code.toUpperCase() } });
    if (existing && existing.id !== branchId) return { ok: false, error: "A branch with this code already exists." };
    await ctx.db.branch.update({ where: { id: branchId }, data: { name: input.name, code: input.code.toUpperCase(), address: input.address || null, phone: input.phone || null } });
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "BRANCH_UPDATED", entityType: "Branch", entityId: branchId, metadata: { name: input.name, code: input.code.toUpperCase() } });
    revalidatePath("/dashboard/settings/branches");
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deactivateBranch(branchId: string): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "BRANCHES_MANAGE");
    assertOwner(ctx);
    const branch = await ctx.db.branch.findFirst({ where: { id: branchId } });
    if (!branch) return { ok: false, error: "Branch not found." };
    await ctx.db.branch.update({ where: { id: branchId }, data: { isActive: false } });
    await ctx.db.register.updateMany({ where: { branchId }, data: { isActive: false } });
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "BRANCH_DEACTIVATED", entityType: "Branch", entityId: branchId });
    revalidatePath("/dashboard/settings/branches");
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}
