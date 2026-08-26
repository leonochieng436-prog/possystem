"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { openCashSession } from "@/app/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CashSessionForm({ branchId, registerId }: { branchId: string; registerId: string }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  function submit(formData: FormData) { startTransition(async () => { const result = await openCashSession({ branchId, registerId, openingBalance: String(formData.get("openingBalance") || "") }); if (result.ok) router.refresh(); }); }
  return <form action={submit} className="flex gap-2"><Input name="openingBalance" type="number" min="0" step="0.01" placeholder="Opening cash balance" required /><Button type="submit" disabled={pending}>{pending ? "Opening..." : "Open register"}</Button></form>;
}
