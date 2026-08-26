"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext, assertPermission, AuthError } from "@/server/auth/context";
import { recordAudit } from "@/server/services/audit";
import { changePlanSchema } from "@/lib/validation/billing";
import type { ActionResult } from "./auth";

const PLANS = {
  trial: { branchLimit: 1, userLimit: 5, days: 14 },
  starter: { branchLimit: 1, userLimit: 5, days: 30 },
  growth: { branchLimit: 5, userLimit: 25, days: 30 },
  enterprise: { branchLimit: 999, userLimit: 999, days: 30 },
} as const;

export async function changePlan(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const ctx = await requireAuthContext(); assertPermission(ctx, "BILLING_MANAGE");
    const parsed = changePlanSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: "Choose a valid plan." };
    const input = parsed.data; const plan = PLANS[input.plan];
    const subscription = await ctx.db.subscription.upsert({ where: { organizationId: ctx.organizationId }, update: { plan: input.plan, status: input.plan === "trial" ? "trialing" : "active", branchLimit: plan.branchLimit, userLimit: plan.userLimit, currentPeriodEnd: new Date(Date.now() + plan.days * 86400000), trialEndsAt: input.plan === "trial" ? new Date(Date.now() + plan.days * 86400000) : null }, create: { organizationId: ctx.organizationId, plan: input.plan, status: input.plan === "trial" ? "trialing" : "active", branchLimit: plan.branchLimit, userLimit: plan.userLimit, currentPeriodEnd: new Date(Date.now() + plan.days * 86400000), trialEndsAt: input.plan === "trial" ? new Date(Date.now() + plan.days * 86400000) : null } });
    await recordAudit({ organizationId: ctx.organizationId, userId: ctx.userId, action: "SUBSCRIPTION_PLAN_CHANGED", entityType: "Subscription", entityId: subscription.id, metadata: { plan: input.plan } });
    revalidatePath("/dashboard/billing"); return { ok: true, data: undefined };
  } catch (e) { if (e instanceof AuthError) return { ok: false, error: e.message }; throw e; }
}
