"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    <form action={handleSubmit} className="login-form space-y-6">
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-sm)] bg-primary text-white shadow-[0_8px_18px_rgba(15,123,108,0.22)]">D</span>
        <span className="text-lg font-bold tracking-[0.16em] text-foreground">DUKAOS</span>
      </div>
      <div>
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-primary-tint text-primary">
          <ShieldCheck size={22} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Secure business access</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Sign in to DUKAOS</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Access your sales, inventory, customers, and business reports.</p>
      </div>

      {error && (
        <div className="rounded-[var(--radius-sm)] bg-danger-tint px-3 py-2 text-[13px] text-danger">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail size={17} className="pointer-events-none absolute left-3 top-3 text-muted-foreground" />
          <Input id="email" name="email" type="email" placeholder="you@business.co.ke" required className="h-11 pl-10" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <a href="/forgot-password" className="text-[12px] font-medium text-primary hover:underline">
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <LockKeyhole size={17} className="pointer-events-none absolute left-3 top-3 text-muted-foreground" />
          <Input id="password" name="password" type={showPassword ? "text" : "password"} required className="h-11 pl-10 pr-11" />
          <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-surface-muted hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <input type="checkbox" name="remember" className="h-4 w-4 accent-primary" />
        Remember me on this device
      </label>

      <Button type="submit" size="lg" className="h-12 w-full justify-center gap-2 bg-primary text-white shadow-[0_10px_22px_rgba(15,123,108,0.2)] hover:bg-primary-hover" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in to DUKAOS"} {!isPending && <ArrowRight size={17} />}
      </Button>

      <p className="border-t border-border pt-5 text-center text-[13px] text-muted-foreground">
        New here?{" "}
        <a href="/register" className="font-semibold text-primary hover:underline">
          Create a business account
        </a>
      </p>
    </form>
  );
}
