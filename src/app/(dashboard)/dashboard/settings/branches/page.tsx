import { requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewBranchForm } from "./new-branch-form";

export default async function BranchesPage() {
  const ctx = await requireAuthContext();
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
                <Badge variant={b.isActive ? "success" : "neutral"}>
                  {b.isActive ? "Active" : "Inactive"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <NewBranchForm />
    </div>
  );
}
