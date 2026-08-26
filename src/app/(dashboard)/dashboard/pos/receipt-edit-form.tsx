"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReceiptNotes } from "@/app/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReceiptEditForm({ saleId, notes }: { saleId: string; notes: string | null }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const [message, setMessage] = useState("");
  function submit(formData: FormData) { setMessage(""); startTransition(async () => { const result = await updateReceiptNotes({ saleId, notes: String(formData.get("notes") || "") }); setMessage(result.ok ? "Receipt note saved." : result.error); if (result.ok) router.refresh(); }); }
  return <form action={submit} className="flex gap-2"><Input name="notes" defaultValue={notes ?? ""} placeholder="Receipt note or customer reference" maxLength={300} /><Button type="submit" variant="secondary" disabled={pending}>{pending ? "Saving..." : "Edit note"}</Button>{message && <span className="self-center text-[12px] text-muted-foreground">{message}</span>}</form>;
}
