"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerOrganization } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BUSINESS_TYPES = [
  { value: "general_store", label: "General store" },
  { value: "retail", label: "Retail shop" },
  { value: "supermarket", label: "Supermarket / mini-market" },
  { value: "hardware", label: "Hardware store" },
  { value: "electronics", label: "Electronics shop" },
  { value: "clothing", label: "Clothing store" },
  { value: "beauty", label: "Beauty / cosmetics" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "restaurant", label: "Restaurant" },
  { value: "wholesale", label: "Wholesaler / distributor" },
];

export function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    const payload = {
      businessName: String(formData.get("businessName") || ""),
      ownerName: String(formData.get("ownerName") || ""),
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      phone: String(formData.get("phone") || ""),
      businessType: String(formData.get("businessType") || "general_store"),
      country: "KE",
    };

    startTransition(async () => {
      const result = await registerOrganization(payload);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.push(result.data.redirectTo);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Set up your business</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Free 14-day trial. No card required.
        </p>
      </div>

      {error && (
        <div className="rounded-[var(--radius-sm)] bg-danger-tint px-3 py-2 text-[13px] text-danger">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="businessName">Business name</Label>
        <Input id="businessName" name="businessName" placeholder="Leon Retail Store" required />
        {fieldErrors.businessName && (
          <p className="text-[12px] text-danger">{fieldErrors.businessName[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="businessType">Business type</Label>
        <select
          id="businessType"
          name="businessType"
          className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          defaultValue="general_store"
        >
          {BUSINESS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ownerName">Your name</Label>
          <Input id="ownerName" name="ownerName" placeholder="Leon Otieno" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" placeholder="07xx xxx xxx" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="you@business.co.ke" required />
        {fieldErrors.email && (
          <p className="text-[12px] text-danger">{fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" placeholder="At least 8 characters" required />
        {fieldErrors.password && (
          <p className="text-[12px] text-danger">{fieldErrors.password[0]}</p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Creating your workspace…" : "Create business account"}
      </Button>

      <p className="text-center text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <a href="/login" className="text-primary hover:underline">
          Log in
        </a>
      </p>
    </form>
  );
}
