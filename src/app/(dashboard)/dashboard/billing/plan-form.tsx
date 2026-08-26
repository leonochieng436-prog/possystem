"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePlan } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";

export function PlanForm({ currentPlan }: { currentPlan: string }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  function submit(formData: FormData) { startTransition(async () => { const result = await changePlan({ plan: String(formData.get("plan") || "") }); if (result.ok) router.refresh(); }); }
  return <form action={submit} className="flex gap-2"><select name="plan" defaultValue={currentPlan} className="h-9 rounded border border-border-strong bg-surface px-2 text-sm"><option value="trial">Trial</option><option value="starter">Starter</option><option value="growth">Growth</option><option value="enterprise">Enterprise</option></select><Button type="submit" disabled={pending}>{pending ? "Saving..." : "Change plan"}</Button></form>;
}
