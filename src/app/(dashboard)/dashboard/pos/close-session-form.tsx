"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeCashSession } from "@/app/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type ClientRegisterSummary = { transactionCount: number; totalSales: string; payments: Record<string, string>; expectedCash: string; branch: string; register: string };

export function CloseSessionForm({ sessionId, summary }: { sessionId: string; summary: ClientRegisterSummary }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  function submit(formData: FormData) { startTransition(async () => { const result = await closeCashSession({ sessionId, actualBalance: String(formData.get("actualBalance") || "") }); if (result.ok) router.refresh(); }); }
  return <details className="relative"><summary className="cursor-pointer list-none"><Button type="button" variant="secondary">Close register</Button></summary><div className="absolute right-0 top-11 z-20 w-[min(92vw,360px)] rounded-[var(--radius-md)] border border-border bg-surface p-4 text-foreground shadow-[0_12px_30px_rgba(18,23,26,0.14)]"><p className="text-sm font-semibold">Close register</p><p className="mt-1 text-[12px] text-muted-foreground">{summary.branch} · {summary.register}</p><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><span>Transactions</span><strong className="text-right">{summary.transactionCount}</strong><span>Total sales</span><strong className="text-right">KES {summary.totalSales}</strong>{Object.entries(summary.payments).filter(([, amount]) => amount !== "0.00").map(([method, amount]) => <span key={method} className="contents"><span>{method}</span><strong className="text-right">KES {amount}</strong></span>)}<span>Expected cash</span><strong className="text-right">KES {summary.expectedCash}</strong></div><Input name="actualBalance" form={`close-session-${sessionId}`} type="number" min="0" step="0.01" placeholder="Count physical cash" required className="mt-3" /><form id={`close-session-${sessionId}`} action={submit} className="mt-2"><Button type="submit" variant="secondary" disabled={pending} className="w-full">{pending ? "Closing..." : "Confirm close"}</Button></form></div></details>;
}
