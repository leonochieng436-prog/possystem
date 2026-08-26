"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateUser } from "@/app/actions/users";
import { Button } from "@/components/ui/button";

export function UserActions({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function deactivate() {
    if (!window.confirm(`Deactivate ${name}? Historical records will be preserved.`)) return;
    setError("");
    startTransition(async () => {
      const result = await deactivateUser(userId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }
  return <div className="flex items-center gap-2"><Button type="button" variant="secondary" size="sm" onClick={deactivate} disabled={pending}>{pending ? "Deactivating..." : "Deactivate"}</Button>{error && <span className="text-[12px] text-danger">{error}</span>}</div>;
}
