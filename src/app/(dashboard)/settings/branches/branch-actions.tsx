"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateBranch, updateBranch } from "@/app/actions/branches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Branch = { id: string; name: string; code: string; address: string | null; phone: string | null };

export function BranchActions({ branch }: { branch: Branch }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  function save(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await updateBranch(branch.id, { name: String(formData.get("name") || ""), code: String(formData.get("code") || ""), address: String(formData.get("address") || ""), phone: String(formData.get("phone") || "") });
      if (!result.ok) return setError(result.error);
      setEditing(false); router.refresh();
    });
  }
  function deactivate() {
    if (!window.confirm(`Deactivate ${branch.name}? Historical records will be preserved.`)) return;
    startTransition(async () => { const result = await deactivateBranch(branch.id); if (!result.ok) return setError(result.error); router.refresh(); });
  }
  return <div className="flex items-center gap-2">{editing ? <form action={save} className="flex flex-wrap items-center gap-2"><Input name="name" defaultValue={branch.name} className="h-8 w-32" required /><Input name="code" defaultValue={branch.code} className="h-8 w-20" required /><Button type="submit" size="sm" disabled={pending}>Save</Button><Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button></form> : <><Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)} disabled={pending}>Edit</Button><Button type="button" variant="secondary" size="sm" onClick={deactivate} disabled={pending}>Deactivate</Button></>}{error && <span className="text-[12px] text-danger">{error}</span>}</div>;
}
