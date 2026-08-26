"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { rawPrisma } from "@/server/db/client";
import { requireAuthContext, assertPermission, AuthError } from "@/server/auth/context";
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

    const email = input.email.toLowerCase();
    let user = await rawPrisma.user.findUnique({ where: { email } });
    const temporaryPassword = randomBytes(6).toString("base64url");

    if (user) {
      const existingMembership = await rawPrisma.userOrganization.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: ctx.organizationId } },
      });
      if (existingMembership) {
        return { ok: false, error: "This person is already a member of your business." };
      }
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
