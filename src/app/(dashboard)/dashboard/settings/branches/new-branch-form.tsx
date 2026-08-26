"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBranch } from "@/app/actions/branches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export function NewBranchForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    const payload = {
      name: String(formData.get("name") || ""),
      code: String(formData.get("code") || ""),
      address: String(formData.get("address") || ""),
      phone: String(formData.get("phone") || ""),
    };

    startTransition(async () => {
      const result = await createBranch(payload);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.refresh();
      (document.getElementById("new-branch-form") as HTMLFormElement)?.reset();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a branch</CardTitle>
        <CardDescription>
          Creates the branch with a default warehouse and Register 1, ready to use.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="new-branch-form" action={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-[var(--radius-sm)] bg-danger-tint px-3 py-2 text-[13px] text-danger">
              {error}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Branch name</Label>
              <Input id="name" name="name" placeholder="Mombasa Branch" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Branch code</Label>
              <Input id="code" name="code" placeholder="MSA" required />
              {fieldErrors.code && (
                <p className="text-[12px] text-danger">{fieldErrors.code[0]}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" placeholder="Moi Avenue, Mombasa" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" placeholder="07xx xxx xxx" />
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create branch"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
