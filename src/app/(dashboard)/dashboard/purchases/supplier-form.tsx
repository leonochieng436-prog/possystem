"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupplier } from "@/app/actions/purchases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SupplierForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit(formData: FormData) {
    setError("");
    const payload = Object.fromEntries(formData.entries());
    startTransition(async () => {
      const result = await createSupplier(payload);
      if (!result.ok) return setError(result.error);
      (document.getElementById("supplier-form") as HTMLFormElement)?.reset();
      router.refresh();
    });
  }

  return (
    <form id="supplier-form" action={submit} className="space-y-3">
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="supplier-name">Name</Label><Input id="supplier-name" name="name" required /></div>
        <div className="space-y-1"><Label htmlFor="supplier-company">Company</Label><Input id="supplier-company" name="companyName" /></div>
        <div className="space-y-1"><Label htmlFor="supplier-phone">Phone</Label><Input id="supplier-phone" name="phone" /></div>
        <div className="space-y-1"><Label htmlFor="supplier-email">Email</Label><Input id="supplier-email" name="email" type="email" /></div>
        <div className="space-y-1"><Label htmlFor="supplier-terms">Payment terms</Label><Input id="supplier-terms" name="paymentTerms" placeholder="Net 30" /></div>
        <div className="space-y-1"><Label htmlFor="supplier-pin">Tax PIN</Label><Input id="supplier-pin" name="taxPin" /></div>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Add supplier"}</Button>
    </form>
  );
}
