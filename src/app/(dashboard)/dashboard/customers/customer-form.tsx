"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCustomer, recordCustomerPayment } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CustomerForm() {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  function submit(formData: FormData) { startTransition(async () => { const result = await createCustomer(Object.fromEntries(formData.entries())); if (result.ok) { (document.getElementById("customer-form") as HTMLFormElement)?.reset(); router.refresh(); } }); }
  return <form id="customer-form" action={submit} className="grid gap-2 sm:grid-cols-4"><Input name="name" placeholder="Customer name" required /><Input name="phone" placeholder="Phone" /><Input name="email" type="email" placeholder="Email" /><Input name="creditLimit" type="number" min="0" step="0.01" placeholder="Credit limit" required /><select name="category" defaultValue="REGULAR" className="h-9 rounded border border-border-strong bg-surface px-2 text-sm"><option value="NEW">New</option><option value="REGULAR">Regular</option><option value="VIP">VIP</option><option value="CREDIT">Credit</option></select><Button type="submit" disabled={pending}>{pending ? "Saving..." : "Add customer"}</Button></form>;
}

export function CustomerPaymentForm({ customers }: { customers: { id: string; name: string }[] }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  function submit(formData: FormData) { startTransition(async () => { const result = await recordCustomerPayment(Object.fromEntries(formData.entries())); if (result.ok) { (document.getElementById("customer-payment-form") as HTMLFormElement)?.reset(); router.refresh(); } }); }
  return <form id="customer-payment-form" action={submit} className="grid gap-2 sm:grid-cols-4"><select name="customerId" required className="h-9 rounded border border-border-strong bg-surface px-2 text-sm"><option value="">Customer...</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount" required /><select name="method" defaultValue="cash" className="h-9 rounded border border-border-strong bg-surface px-2 text-sm"><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank</option><option value="card">Card</option></select><Button type="submit" disabled={pending}>{pending ? "Saving..." : "Record payment"}</Button></form>;
}
