"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    const payload = {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
    };

    startTransition(async () => {
      const result = await login(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.data.redirectTo);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Log in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back to your business dashboard.
        </p>
      </div>

      {error && (
        <div className="rounded-[var(--radius-sm)] bg-danger-tint px-3 py-2 text-[13px] text-danger">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="you@business.co.ke" required />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <a href="/forgot-password" className="text-[12px] text-primary hover:underline">
            Forgot password?
          </a>
        </div>
        <Input id="password" name="password" type="password" required />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Logging in…" : "Log in"}
      </Button>

      <p className="text-center text-[13px] text-muted-foreground">
        New here?{" "}
        <a href="/register" className="text-primary hover:underline">
          Create a business account
        </a>
      </p>
    </form>
  );
}
