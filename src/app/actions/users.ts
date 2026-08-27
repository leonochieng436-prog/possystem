"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { rawPrisma } from "@/server/db/client";
import { requireAuthContext, assertPermission, assertOwner, AuthError } from "@/server/auth/context";
import { hashPassword } from "@/server/auth/password";
import { recordAudit } from "@/server/services/audit";
import { inviteUserSchema } from "@/lib/validation/auth";
import type { ActionResult } from "./auth";

/**
 * Invites a teammate into the current organization. There is no email
 * provider wired up yet (see .env.example), so this creates the account
 * with a random temporary password and surfaces it directly in the
 * response for the admin to relay — clearly a stopgap, not pretending to
 * be an email invite. TODO(email-integration): send a real invite email
 * with a set-password link instead once EMAIL_API_KEY is configured.
 */
export async function inviteUser(
  raw: unknown
): Promise<ActionResult<{ temporaryPassword: string }>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "USERS_MANAGE");

    const parsed = inviteUserSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please fix the errors below.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    const input = parsed.data;

    const role = await ctx.db.role.findFirst({ where: { id: input.roleId } });
    if (!role) {
      return { ok: false, error: "That role no longer exists." };
    }
    const branches = await ctx.db.branch.findMany({ where: { id: { in: input.branchIds } }, select: { id: true } });
    if (branches.length !== new Set(input.branchIds).size) return { ok: false, error: "One or more selected branches are not available." };

    const email = input.email.toLowerCase();
    let user = await rawPrisma.user.findUnique({ where: { email } });
    const temporaryPassword = randomBytes(6).toString("base64url");

    if (user) {
      return { ok: false, error: "This email already belongs to an account. Use a new email for this business." };
    } else {
      user = await rawPrisma.user.create({
        data: {
          name: input.name,
          email,
          passwordHash: await hashPassword(temporaryPassword),
        },
      });
    }

    await rawPrisma.userOrganization.create({
      data: { userId: user.id, organizationId: ctx.organizationId, roleId: role.id },
    });

    if (input.branchIds.length > 0) {
      await rawPrisma.userBranch.createMany({
        data: input.branchIds.map((branchId) => ({ userId: user!.id, branchId })),
        skipDuplicates: true,
      });
    }

    await recordAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "USER_INVITED",
      entityType: "User",
      entityId: user.id,
      metadata: { email, roleId: role.id },
    });

    revalidatePath("/dashboard/settings/users");
    return { ok: true, data: { temporaryPassword } };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deactivateUser(userId: string): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "USERS_MANAGE");
    assertOwner(ctx);
    if (!userId || userId === ctx.userId) return { ok: false, error: "You cannot deactivate yourself." };

    const membership = await rawPrisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId, organizationId: ctx.organizationId } },
    });
    if (!membership) return { ok: false, error: "Team member not found." };
    if (membership.isOwner) return { ok: false, error: "The organization owner cannot be deactivated." };

    await rawPrisma.$transaction([
      rawPrisma.userOrganization.update({ where: { id: membership.id }, data: { isActive: false } }),
      rawPrisma.session.deleteMany({ where: { userId, organizationId: ctx.organizationId } }),
    ]);
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "USER_DEACTIVATED", entityType: "User", entityId: userId });
    revalidatePath("/dashboard/settings/users");
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updateUser(userId: string, raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "USERS_MANAGE");
    assertOwner(ctx);
    if (!userId || userId === ctx.userId) return { ok: false, error: "You cannot edit yourself here." };
    const parsed = inviteUserSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Please fix the user details." };
    const input = parsed.data;
    const membership = await rawPrisma.userOrganization.findUnique({ where: { userId_organizationId: { userId, organizationId: ctx.organizationId } } });
    if (!membership || membership.isOwner) return { ok: false, error: "That team member cannot be edited." };
    const role = await ctx.db.role.findFirst({ where: { id: input.roleId } });
    if (!role) return { ok: false, error: "That role no longer exists." };
    const branches = await ctx.db.branch.findMany({ where: { id: { in: input.branchIds } }, select: { id: true } });
    if (branches.length !== new Set(input.branchIds).size) return { ok: false, error: "One or more selected branches are not available." };
    const email = input.email.toLowerCase();
    const existingUser = await rawPrisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.id !== userId) return { ok: false, error: "That email is already in use." };
    await rawPrisma.$transaction([
      rawPrisma.user.update({ where: { id: userId }, data: { name: input.name, email } }),
      rawPrisma.userOrganization.update({ where: { id: membership.id }, data: { roleId: input.roleId } }),
      rawPrisma.userBranch.deleteMany({ where: { userId, branch: { organizationId: ctx.organizationId } } }),
      ...(input.branchIds.length > 0 ? [rawPrisma.userBranch.createMany({ data: input.branchIds.map((branchId) => ({ userId, branchId })) })] : []),
    ]);
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "USER_UPDATED", entityType: "User", entityId: userId, metadata: { email, roleId: input.roleId } });
    revalidatePath("/dashboard/settings/users");
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function resetUserPassword(userId: string): Promise<ActionResult<{ temporaryPassword: string }>> {
  try {
    const ctx = await requireAuthContext();
    assertPermission(ctx, "USERS_MANAGE");
    assertOwner(ctx);
    if (!userId || userId === ctx.userId) return { ok: false, error: "Use your own account password settings to change this password." };
    const membership = await rawPrisma.userOrganization.findUnique({ where: { userId_organizationId: { userId, organizationId: ctx.organizationId } } });
    if (!membership || membership.isOwner) return { ok: false, error: "That team member cannot be reset." };
    const temporaryPassword = randomBytes(6).toString("base64url");
    await rawPrisma.$transaction([
      rawPrisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(temporaryPassword) } }),
      rawPrisma.session.deleteMany({ where: { userId, organizationId: ctx.organizationId } }),
    ]);
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "USER_PASSWORD_RESET", entityType: "User", entityId: userId });
    revalidatePath("/dashboard/settings/users");
    return { ok: true, data: { temporaryPassword } };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
}
