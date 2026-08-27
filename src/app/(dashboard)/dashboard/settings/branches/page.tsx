import { assertPermission, requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewBranchForm } from "./new-branch-form";
import { ResourceActions } from "./resource-actions";

export default async function BranchesPage() {
  const ctx = await requireAuthContext();
  assertPermission(ctx, "BRANCHES_MANAGE");
  const branches = await ctx.db.branch.findMany({
    include: { warehouses: true, registers: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold">Branches</h1>
        <p className="text-sm text-muted-foreground">
          Each branch gets its own warehouse and POS registers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All branches ({branches.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {branches.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{b.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {b.code} &middot; {b.warehouses.length} warehouse(s) &middot;{" "}
                    {b.registers.length} register(s)
                  </p>
                </div>
                <div className="flex items-center gap-3"><Badge variant={b.isActive ? "success" : "neutral"}>{b.isActive ? "Active" : "Inactive"}</Badge>{b.isActive && <ResourceActions type="branch" id={b.id} name={b.name} />}</div>
                {b.isActive && (b.warehouses.length > 0 || b.registers.length > 0) && <div className="col-span-full mt-2 space-y-2 border-t border-border pt-2 pl-4">{b.warehouses.map((warehouse) => <div key={warehouse.id} className="flex items-center justify-between text-[12px]"><span>{warehouse.name} <span className="text-muted-foreground">· warehouse</span></span>{warehouse.isActive && <ResourceActions type="warehouse" id={warehouse.id} name={warehouse.name} />}</div>)}{b.registers.map((register) => <div key={register.id} className="flex items-center justify-between text-[12px]"><span>{register.name} <span className="text-muted-foreground">· register</span></span>{register.isActive && <ResourceActions type="register" id={register.id} name={register.name} />}</div>)}</div>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <NewBranchForm />
    </div>
  );
}
