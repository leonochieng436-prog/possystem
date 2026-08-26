"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { receivePurchase } from "@/app/actions/purchases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Item = { id: string; label: string; remaining: string };

export function ReceiveForm({ purchaseOrderId, items }: { purchaseOrderId: string; items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(items.map((item) => [item.id, item.remaining])));

  function submit(formData: FormData) {
    setError("");
    const payload = { purchaseOrderId, notes: String(formData.get("notes") || ""), items: items.filter((item) => Number(quantities[item.id]) > 0).map((item) => ({ purchaseOrderItemId: item.id, quantity: quantities[item.id], batchNumber: String(formData.get(`batch-${item.id}`) || ""), expiryDate: String(formData.get(`expiry-${item.id}`) || "") })) };
    startTransition(async () => {
      const result = await receivePurchase(payload);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }

  return <form action={submit} className="mt-3 space-y-2 border-t border-border pt-3">{error && <p className="text-[13px] text-danger">{error}</p>}{items.map((item) => <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_120px_140px_140px]"><span className="self-center text-[13px]">{item.label} <span className="text-muted-foreground">({item.remaining} remaining)</span></span><Input aria-label={`Receive ${item.label}`} type="number" min="0" max={item.remaining} step="0.001" value={quantities[item.id]} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} /><Input name={`batch-${item.id}`} placeholder="Batch number" /><Input name={`expiry-${item.id}`} type="date" /></div>)}<Input name="notes" placeholder="Receipt notes (optional)" /><Button type="submit" disabled={pending}>{pending ? "Receiving..." : "Receive stock"}</Button></form>;
}
