"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeCashSession } from "@/app/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CloseSessionForm({ sessionId }: { sessionId: string }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  function submit(formData: FormData) { startTransition(async () => { const result = await closeCashSession({ sessionId, actualBalance: String(formData.get("actualBalance") || "") }); if (result.ok) router.refresh(); }); }
  return <form action={submit} className="flex gap-2"><Input name="actualBalance" type="number" min="0" step="0.01" placeholder="Actual cash balance" required /><Button type="submit" variant="secondary" disabled={pending}>{pending ? "Closing..." : "Close register"}</Button></form>;
}
