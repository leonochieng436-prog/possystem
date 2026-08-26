"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBusinessProfile } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BusinessProfileForm({ profile }: { profile: { name: string; legalName: string | null; taxPin: string | null; phone: string | null; email: string | null; address: string | null; businessType: string | null } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  function submit(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      const result = await updateBusinessProfile(Object.fromEntries(formData.entries()));
      setMessage(result.ok ? "Business profile saved." : result.error);
      if (result.ok) router.refresh();
    });
  }
  return <form action={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="business-name">Business name</Label><Input id="business-name" name="name" defaultValue={profile.name} required /></div><div className="space-y-1.5"><Label htmlFor="legal-name">Legal name</Label><Input id="legal-name" name="legalName" defaultValue={profile.legalName ?? ""} /></div><div className="space-y-1.5"><Label htmlFor="business-type">Business type</Label><Input id="business-type" name="businessType" defaultValue={profile.businessType ?? "retail"} /></div><div className="space-y-1.5"><Label htmlFor="tax-pin">Tax PIN</Label><Input id="tax-pin" name="taxPin" defaultValue={profile.taxPin ?? ""} /></div><div className="space-y-1.5"><Label htmlFor="business-phone">Phone</Label><Input id="business-phone" name="phone" defaultValue={profile.phone ?? ""} /></div><div className="space-y-1.5"><Label htmlFor="business-email">Email</Label><Input id="business-email" name="email" type="email" defaultValue={profile.email ?? ""} /></div></div><div className="space-y-1.5"><Label htmlFor="business-address">Address</Label><Input id="business-address" name="address" defaultValue={profile.address ?? ""} /></div>{message && <p className="text-[13px] text-muted-foreground">{message}</p>}<Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save business profile"}</Button></form>;
}
