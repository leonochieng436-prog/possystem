"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteUser } from "@/app/actions/users";
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

type RoleOption = { id: string; name: string };
type BranchOption = { id: string; name: string };

export function InviteUserForm({
  roles,
  branches,
}: {
  roles: RoleOption[];
  branches: BranchOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setTempPassword(null);
    const branchIds = formData.getAll("branchIds").map(String);
    const payload = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      roleId: String(formData.get("roleId") || ""),
      branchIds,
    };

    startTransition(async () => {
      const result = await inviteUser(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTempPassword(result.data.temporaryPassword);
      router.refresh();
      (document.getElementById("invite-user-form") as HTMLFormElement)?.reset();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a team member</CardTitle>
        <CardDescription>
          Leave branches unselected to give this role access to all branches
          (Owner/Administrator/Manager only — other roles are restricted to
          the branches you pick).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-[var(--radius-sm)] bg-danger-tint px-3 py-2 text-[13px] text-danger">
            {error}
          </div>
        )}
        {tempPassword && (
          <div className="rounded-[var(--radius-sm)] bg-success-tint px-3 py-2 text-[13px] text-success">
            Account created. Temporary password:{" "}
            <span className="font-tabular font-semibold">{tempPassword}</span>
            <br />
            Share this with them directly — email invites aren&apos;t wired up
            yet.
          </div>
        )}
        <form id="invite-user-form" action={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="roleId">Role</Label>
            <select
              id="roleId"
              name="roleId"
              required
              className="h-9 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Select a role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Branch access</Label>
            <div className="flex flex-wrap gap-3">
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-1.5 text-[13px]">
                  <input type="checkbox" name="branchIds" value={b.id} />
                  {b.name}
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Adding…" : "Add team member"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
