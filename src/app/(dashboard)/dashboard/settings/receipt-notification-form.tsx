"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReceiptSettings, updateNotificationSettings } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EVENTS = [
  ["LOW_STOCK", "Low stock"],
  ["OUT_OF_STOCK", "Out of stock"],
  ["EXPIRING_STOCK", "Expiring stock"],
  ["LARGE_REFUND", "Large refund"],
  ["CASH_VARIANCE", "Cash variance"],
  ["FAILED_PAYMENT", "Failed payment"],
] as const;

type ReceiptValues = { paperSize: string; footerMessage: string | null; autoPrint: boolean; showBusinessLogo: boolean; showCashier: boolean; showCustomer: boolean; showSku: boolean; showTax: boolean; showDiscount: boolean; showPaymentReference: boolean };
type NotificationValue = { eventKey: string; dashboard: boolean; email: boolean; enabled: boolean };

export function ReceiptSettingsForm({ settings }: { settings: ReceiptValues | null }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const [message, setMessage] = useState("");
  const current = settings ?? { paperSize: "80mm", footerMessage: "Thank you for shopping with us!", autoPrint: true, showBusinessLogo: true, showCashier: true, showCustomer: true, showSku: true, showTax: true, showDiscount: true, showPaymentReference: true };
  function submit(formData: FormData) { setMessage(""); const payload = { paperSize: String(formData.get("paperSize") || "80mm"), footerMessage: String(formData.get("footerMessage") || ""), autoPrint: formData.get("autoPrint") === "on", showBusinessLogo: formData.get("showBusinessLogo") === "on", showCashier: formData.get("showCashier") === "on", showCustomer: formData.get("showCustomer") === "on", showSku: formData.get("showSku") === "on", showTax: formData.get("showTax") === "on", showDiscount: formData.get("showDiscount") === "on", showPaymentReference: formData.get("showPaymentReference") === "on" }; startTransition(async () => { const result = await updateReceiptSettings(payload); setMessage(result.ok ? "Receipt settings saved." : result.error); if (result.ok) router.refresh(); }); }
  return <form action={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="paperSize">Paper size</Label><select id="paperSize" name="paperSize" defaultValue={current.paperSize} className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm"><option value="80mm">80mm thermal</option><option value="58mm">58mm thermal</option><option value="A4">A4 invoice</option></select></div><div className="space-y-1.5"><Label htmlFor="footerMessage">Footer message</Label><Input id="footerMessage" name="footerMessage" defaultValue={current.footerMessage ?? ""} /></div></div><div className="grid gap-2 sm:grid-cols-2">{[["autoPrint", "Auto-print after sale"], ["showBusinessLogo", "Show business logo"], ["showCashier", "Show cashier"], ["showCustomer", "Show customer"], ["showSku", "Show SKU"], ["showTax", "Show tax"], ["showDiscount", "Show discount"], ["showPaymentReference", "Show payment reference"]].map(([name, label]) => <label key={name} className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={Boolean(current[name as keyof ReceiptValues])} />{label}</label>)}</div>{message && <p className="text-[13px] text-muted-foreground">{message}</p>}<Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save receipt settings"}</Button></form>;
}

export function NotificationSettingsForm({ settings }: { settings: NotificationValue[] }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const [message, setMessage] = useState("");
  function submit(formData: FormData) { setMessage(""); const payload = EVENTS.map(([eventKey]) => ({ eventKey, enabled: formData.get(`enabled-${eventKey}`) === "on", dashboard: formData.get(`dashboard-${eventKey}`) === "on", email: formData.get(`email-${eventKey}`) === "on" })); startTransition(async () => { const result = await updateNotificationSettings(payload); setMessage(result.ok ? "Notification settings saved." : result.error); if (result.ok) router.refresh(); }); }
  return <form action={submit} className="space-y-4"><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th className="py-2">Event</th><th className="py-2 text-center">Enabled</th><th className="py-2 text-center">Dashboard</th><th className="py-2 text-center">Email</th></tr></thead><tbody className="divide-y divide-border">{EVENTS.map(([eventKey, label]) => { const value = settings.find((item) => item.eventKey === eventKey); return <tr key={eventKey}><td className="py-3 font-medium">{label}</td><td className="text-center"><input type="checkbox" name={`enabled-${eventKey}`} defaultChecked={value?.enabled ?? true} /></td><td className="text-center"><input type="checkbox" name={`dashboard-${eventKey}`} defaultChecked={value?.dashboard ?? true} /></td><td className="text-center"><input type="checkbox" name={`email-${eventKey}`} defaultChecked={value?.email ?? false} /></td></tr>; })}</tbody></table></div>{message && <p className="text-[13px] text-muted-foreground">{message}</p>}<Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save notification settings"}</Button></form>;
}
