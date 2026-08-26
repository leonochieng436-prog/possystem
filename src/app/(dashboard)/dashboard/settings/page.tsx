import Link from "next/link";
import { ArrowUpRight, Building2, CreditCard, Package, Users } from "lucide-react";
import { assertPermission, requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const ctx = await requireAuthContext();
  assertPermission(ctx, "SETTINGS_MANAGE");
  const [organization, branches, users, products, subscription] = await Promise.all([
    ctx.db.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } }),
    ctx.db.branch.count({ where: { isActive: true } }),
    ctx.db.userOrganization.count({ where: { isActive: true } }),
    ctx.db.product.count({ where: { isActive: true } }),
    ctx.db.subscription.findUnique({ where: { organizationId: ctx.organizationId } }),
  ]);

  const cards = [
    { label: "Business profile", value: organization.name, detail: `${organization.country} · ${organization.currency}`, href: "/dashboard/settings", icon: Building2 },
    { label: "Active branches", value: String(branches), detail: "Locations in this workspace", href: "/dashboard/settings/branches", icon: Building2 },
    { label: "Team members", value: String(users), detail: "Active organization memberships", href: "/dashboard/settings/users", icon: Users },
    { label: "Products", value: String(products), detail: "Active catalog items", href: "/dashboard/products", icon: Package },
  ];

  return (
    <div className="space-y-7">
      <div className="border-b border-border pb-5">
        <p className="text-sm text-muted-foreground">{organization.name}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Business control center</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Your live workspace at a glance. Configuration areas are permission-aware and become available as each module is implemented.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardContent className="p-4">
                  <Icon size={18} className="text-primary" />
                  <p className="mt-5 text-[12px] text-muted-foreground">{card.label}</p>
                  <p className="mt-1 truncate text-lg font-semibold">{card.value}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">{card.detail}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-success-tint px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-success" />
            <div><p className="text-sm font-medium">Workspace operational</p><p className="text-[12px] text-muted-foreground">Tenant data is connected and scoped.</p></div>
          </div>
          <Link href="/dashboard/billing" className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border px-4 py-3 hover:border-primary/50">
            <div className="flex items-center gap-3"><CreditCard size={18} className="text-primary" /><div><p className="text-sm font-medium">{subscription?.plan ?? "Trial"} plan</p><p className="text-[12px] text-muted-foreground">{subscription?.status ?? "Not configured"}</p></div></div>
            <ArrowUpRight size={16} className="text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}