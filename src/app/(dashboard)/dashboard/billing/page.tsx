import { assertPermission, requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanForm } from "./plan-form";

export default async function BillingPage() {
  const ctx = await requireAuthContext();
  assertPermission(ctx, "BILLING_MANAGE");
  const subscription = await ctx.db.subscription.findUnique({ where: { organizationId: ctx.organizationId } });
  const current = subscription ?? { plan: "trial", status: "trialing", branchLimit: 1, userLimit: 5, trialEndsAt: null, currentPeriodEnd: null };
  return <div className="max-w-2xl space-y-6"><div><h1 className="text-lg font-semibold">Subscriptions & billing</h1><p className="text-sm text-muted-foreground">Manage plan status and organization usage limits.</p></div><Card><CardHeader><CardTitle>Current plan</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm">Plan: <strong>{current.plan}</strong> · Status: <strong>{current.status}</strong></p><p className="text-sm text-muted-foreground">Up to {current.branchLimit} branches and {current.userLimit} users.</p><p className="text-sm text-muted-foreground">Renews: {current.currentPeriodEnd ? current.currentPeriodEnd.toLocaleDateString() : "Not scheduled"}</p><PlanForm currentPlan={current.plan} /></CardContent></Card></div>;
}
