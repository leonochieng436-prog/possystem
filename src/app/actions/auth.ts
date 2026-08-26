"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rawPrisma } from "@/server/db/client";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroyCurrentSession } from "@/server/auth/session";
import { recordAudit } from "@/server/services/audit";
import {
  provisionSystemRoles,
  provisionDefaultExpenseCategories,
  provisionDefaultBranchStructure,
} from "@/server/services/organization";
import { uniqueOrgSlug } from "@/lib/slug";
import { randomBytes, createHash } from "crypto";
import {
  registerOrganizationSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/**
 * Creates a brand-new tenant: Organization, its seeded roles, a default
 * branch/warehouse/register, and the first user as Owner. Everything
 * happens in one DB transaction — a half-created organization (org row
 * with no owner, or roles with no organization) must never be possible.
 */
export async function registerOrganization(
  raw: unknown
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = registerOrganizationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  const existingUser = await rawPrisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (existingUser) {
    return {
      ok: false,
      error: "An account with this email already exists. Try logging in.",
    };
  }

  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueOrgSlug(
    input.businessName,
    async (candidate) =>
      (await rawPrisma.organization.findUnique({
        where: { slug: candidate },
      })) !== null
  );

  const result = await rawPrisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.businessName,
        slug,
        businessType: input.businessType,
        country: input.country,
        phone: input.phone || null,
        email: input.email.toLowerCase(),
      },
    });

    const roles = await provisionSystemRoles(tx, org.id);
    await provisionDefaultExpenseCategories(tx, org.id);
    await provisionDefaultBranchStructure(tx, org.id);

    const user = await tx.user.create({
      data: {
        name: input.ownerName,
        email: input.email.toLowerCase(),
        passwordHash,
      },
    });

    await tx.userOrganization.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        roleId: roles.owner.id,
        isOwner: true,
      },
    });

    await tx.subscription.create({
      data: {
        organizationId: org.id,
        plan: "trial",
        status: "trialing",
        branchLimit: 3,
        userLimit: 10,
        trialEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      },
    });

    return { org, user };
  });

  await recordAudit({
    organizationId: result.org.id,
    userId: result.user.id,
    action: "ORGANIZATION_REGISTERED",
    entityType: "Organization",
    entityId: result.org.id,
  });

  const h = await headers();
  await createSession({
    userId: result.user.id,
    organizationId: result.org.id,
    ipAddress: await clientIp(),
    userAgent: h.get("user-agent"),
  });

  return { ok: true, data: { redirectTo: "/dashboard" } };
}

export async function login(
  raw: unknown
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { email, password } = parsed.data;

  const user = await rawPrisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      organizations: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  // Constant-shape response whether the email exists or not, to avoid
  // leaking which emails are registered.
  // Fixed, valid bcrypt hash with no matching plaintext — used only so a
  // login for a non-existent email takes the same time as a real one.
  const DUMMY_HASH =
    "$2b$12$AcmK/uvCLRGrWL2Yi.Zk9elAcl1xRvwN6Mmz2z4Gx8E3IglDvkzPa";
  const passwordOk = await verifyPassword(
    password,
    user ? user.passwordHash : DUMMY_HASH
  );

  if (!user || !passwordOk || !user.isActive) {
    return { ok: false, error: "Invalid email or password." };
  }

  const membership = user.organizations[0];
  if (!membership) {
    return {
      ok: false,
      error: "This account has no active business. Contact your administrator.",
    };
  }

  const h = await headers();
  await createSession({
    userId: user.id,
    organizationId: membership.organizationId,
    ipAddress: await clientIp(),
    userAgent: h.get("user-agent"),
  });

  await recordAudit({
    organizationId: membership.organizationId,
    userId: user.id,
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
    ipAddress: await clientIp(),
  });

  return { ok: true, data: { redirectTo: "/dashboard" } };
}

const RESET_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutes

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a password reset token. Returns `ok: true` unconditionally
 * whether or not the email exists, to avoid revealing which emails are
 * registered — the caller should always show a generic "check your
 * email" message.
 *
 * TODO(email-integration): this currently only creates the token record.
 * Actually emailing the reset link requires EMAIL_API_KEY to be wired up
 * to a provider (see .env.example / DEPLOYMENT.md) — until then the link
 * is logged server-side so it can be tested manually. This is flagged
 * rather than faked so nobody mistakes it for a working email flow.
 */
export async function requestPasswordReset(
  raw: unknown
): Promise<ActionResult<undefined>> {
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const user = await rawPrisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (user) {
    const token = randomBytes(32).toString("hex");
    await rawPrisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
    // TODO(email-integration): send via configured email provider instead.
    console.log(`[password-reset] ${user.email} -> ${resetUrl}`);
  }

  return { ok: true, data: undefined };
}

export async function resetPassword(
  raw: unknown
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const tokenHash = hashToken(parsed.data.token);
  const resetToken = await rawPrisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt < new Date()
  ) {
    return {
      ok: false,
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await rawPrisma.$transaction([
    rawPrisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    rawPrisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    // Reset invalidates all existing sessions, per standard practice.
    rawPrisma.session.deleteMany({ where: { userId: resetToken.userId } }),
  ]);

  return { ok: true, data: { redirectTo: "/login" } };
}

export async function logout() {
  await destroyCurrentSession();
  redirect("/login");
}
