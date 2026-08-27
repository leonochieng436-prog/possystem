import { assertPermission, requireAuthContext } from "@/server/auth/context";
import { rawPrisma } from "@/server/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InviteUserForm } from "./invite-user-form";
import { UserActions } from "./user-actions";

export default async function UsersPage() {
  const ctx = await requireAuthContext();
  assertPermission(ctx, "USERS_MANAGE");

  const [memberships, roles, branches] = await Promise.all([
    rawPrisma.userOrganization.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        user: { include: { branches: { where: { branch: { organizationId: ctx.organizationId } } } } },
        role: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    ctx.db.role.findMany({ orderBy: { name: "asc" } }),
    ctx.db.branch.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground">
          Manage who has access to {branches.length > 0 ? "your business" : "this workspace"}
          {" "}and what they can do.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members ({memberships.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {memberships.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {m.user.name}
                    {m.isOwner && (
                      <span className="ml-2 text-[11px] text-muted-foreground">(Owner)</span>
                    )}
                  </p>
                  <p className="text-[12px] text-muted-foreground">{m.user.email}</p>
                </div>
                <div className="flex items-center gap-3"><Badge variant={m.isActive ? "primary" : "neutral"}>{m.isActive ? m.role.name : "Deactivated"}</Badge>{m.isActive && !m.isOwner && <UserActions userId={m.userId} name={m.user.name} />}</div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <InviteUserForm
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
