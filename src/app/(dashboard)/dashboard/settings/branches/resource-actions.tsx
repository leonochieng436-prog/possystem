"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateBranch, deactivateRegister, deactivateWarehouse } from "@/app/actions/branches";
import { Button } from "@/components/ui/button";

export function ResourceActions({ type, id, name }: { type: "branch" | "warehouse" | "register"; id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function remove() {
    if (!window.confirm(`Delete ${name}? Historical records will be preserved.`)) return;
    setError("");
    startTransition(async () => {
      const result = type === "branch" ? await deactivateBranch(id) : type === "warehouse" ? await deactivateWarehouse(id) : await deactivateRegister(id);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }
  return <div className="flex items-center gap-2"><Button type="button" variant="secondary" size="sm" onClick={remove} disabled={pending}>{pending ? "Deleting..." : "Delete"}</Button>{error && <span className="text-[12px] text-danger">{error}</span>}</div>;
}