import Link from "next/link";
import { ArrowUpRight, Building2, CreditCard, FileText, KeyRound, Package, Receipt, ShieldCheck, Users, Warehouse } from "lucide-react";
import { assertPermission, requireAuthContext } from "@/server/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessProfileForm } from "./business-profile-form";
import { NotificationSettingsForm, ReceiptSettingsForm } from "./receipt-notification-form";

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<{ section?: string }> }) {
  const ctx = await requireAuthContext();
  assertPermission(ctx, "SETTINGS_MANAGE");
  const section = (await searchParams)?.section ?? "general";
  const show = (name: string) => section === "general" || section === name;
  const [organization, branches, users, products, subscription, warehouses, registers, roles, taxRates, providers, sessions, auditLogs, receiptSettings, notificationSettings] = await Promise.all([
    ctx.db.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } }),
    ctx.db.branch.count({ where: { isActive: true } }),
    ctx.db.userOrganization.count({ where: { isActive: true } }),
    ctx.db.product.count({ where: { isActive: true } }),
    ctx.db.subscription.findUnique({ where: { organizationId: ctx.organizationId } }),
    ctx.db.warehouse.findMany({ where: { isActive: true }, include: { branch: true }, orderBy: { name: "asc" } }),
    ctx.db.register.findMany({ where: { branch: { organizationId: ctx.organizationId } }, include: { branch: true }, orderBy: { createdAt: "asc" } }),
    ctx.db.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { name: "asc" } }),
    ctx.db.taxRate.findMany({ where: { isActive: true }, orderBy: { rate: "asc" } }),
    ctx.db.paymentProviderConfig.findMany({ orderBy: { provider: "asc" } }),
    ctx.db.session.findMany({ where: { organizationId: ctx.organizationId, expiresAt: { gt: new Date() } }, include: { user: true }, orderBy: { createdAt: "desc" } }),
    ctx.db.auditLog.findMany({ take: 8, include: { user: true }, orderBy: { createdAt: "desc" } }),
    ctx.db.receiptSettings.findUnique({ where: { organizationId: ctx.organizationId } }),
    ctx.db.notificationSetting.findMany({ orderBy: { eventKey: "asc" } }),
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
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{section === "general" ? "Business control center" : section.replace("-", " ")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{section === "general" ? "Manage live business configuration, access control, locations, financial rules, and security from one workspace." : "Manage this area of your business settings."}</p>
      </div>

      {show("general") && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      </div>}

      {show("general") && <Card>
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
      </Card>}

      {show("business") && <Card id="business"><CardHeader><CardTitle className="flex items-center gap-2"><Building2 size={17} className="text-primary" /> Business profile</CardTitle></CardHeader><CardContent><BusinessProfileForm profile={organization} /></CardContent></Card>}
      {show("locations") && <Card id="locations"><CardHeader><CardTitle className="flex items-center gap-2"><Warehouse size={17} className="text-primary" /> Warehouses</CardTitle></CardHeader><CardContent><div className="divide-y divide-border">{warehouses.map((warehouse) => <div key={warehouse.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-medium">{warehouse.name}</p><p className="text-[12px] text-muted-foreground">{warehouse.branch.name}</p></div><span className="text-[12px] text-success">Active</span></div>)}</div></CardContent></Card>}
      {show("registers") && <Card id="registers"><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard size={17} className="text-primary" /> Registers</CardTitle></CardHeader><CardContent><div className="divide-y divide-border">{registers.map((register) => <div key={register.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-medium">{register.name}</p><p className="text-[12px] text-muted-foreground">{register.branch.name}</p></div><span className={register.isActive ? "text-[12px] text-success" : "text-[12px] text-muted-foreground"}>{register.isActive ? "Active" : "Inactive"}</span></div>)}</div></CardContent></Card>}
      {show("roles") && <Card id="roles"><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound size={17} className="text-primary" /> Roles & permissions</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2">{roles.map((role) => <div key={role.id} className="rounded-[var(--radius-sm)] border border-border px-3 py-3"><p className="text-sm font-medium">{role.name}</p><p className="mt-1 text-[12px] text-muted-foreground">{role.permissions.length} permissions · {role.isSystem ? "System role" : "Custom role"}</p></div>)}</div></CardContent></Card>}
      {show("security") && <div id="security" className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck size={17} className="text-primary" /> Active sessions</CardTitle></CardHeader><CardContent><p className="mb-3 text-[12px] text-muted-foreground">Current sessions in this organization: {sessions.length}</p>{sessions.slice(0, 5).map((session) => <div key={session.id} className="flex justify-between border-t border-border py-3"><div><p className="text-sm font-medium">{session.user.name}</p><p className="text-[12px] text-muted-foreground">{session.userAgent ?? "Unknown device"}</p></div><p className="text-[12px] text-muted-foreground">{session.createdAt.toLocaleDateString("en-KE")}</p></div>)}</CardContent></Card></div>}
      {show("taxes") && <Card id="taxes"><CardHeader><CardTitle className="flex items-center gap-2"><Receipt size={17} className="text-primary" /> Tax rates</CardTitle></CardHeader><CardContent>{taxRates.map((tax) => <div key={tax.id} className="flex justify-between border-t border-border py-3 first:border-0 first:pt-0"><span className="text-sm">{tax.name}</span><span className="text-sm font-semibold font-tabular">{tax.rate.toString()}%</span></div>)}</CardContent></Card>}
      {show("payments") && <Card id="payments"><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard size={17} className="text-primary" /> Payment providers</CardTitle></CardHeader><CardContent>{providers.length === 0 ? <p className="text-sm text-muted-foreground">No provider credentials are configured.</p> : providers.map((provider) => <div key={provider.id} className="flex justify-between border-t border-border py-3 first:border-0 first:pt-0"><span className="text-sm">{provider.provider}</span><span className={provider.isActive ? "text-sm text-success" : "text-sm text-muted-foreground"}>{provider.isActive ? "Connected" : "Inactive"}</span></div>)}</CardContent></Card>}
      {show("receipts") && <Card id="receipts"><CardHeader><CardTitle className="flex items-center gap-2"><FileText size={17} className="text-primary" /> Receipts & invoices</CardTitle><p className="text-[12px] text-muted-foreground">These preferences are used by receipt and invoice rendering.</p></CardHeader><CardContent><ReceiptSettingsForm settings={receiptSettings} /></CardContent></Card>}
      {show("notifications") && <Card id="notifications"><CardHeader><CardTitle>Notifications</CardTitle><p className="text-[12px] text-muted-foreground">Choose where operational alerts are delivered. Email delivery requires an email provider.</p></CardHeader><CardContent><NotificationSettingsForm settings={notificationSettings} /></CardContent></Card>}
      {show("integrations") && <Card id="integrations"><CardHeader><CardTitle>Integrations</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Stored payment provider configurations are shown above. External email, SMS, storage, and WhatsApp integrations are not configured.</p></CardContent></Card>}
      {show("audit") && <Card id="audit"><CardHeader><CardTitle className="flex items-center gap-2"><FileText size={17} className="text-primary" /> Recent audit activity</CardTitle></CardHeader><CardContent>{auditLogs.map((log) => <div key={log.id} className="flex justify-between border-t border-border py-3 first:border-0 first:pt-0"><div><p className="text-sm font-medium">{log.action.replaceAll("_", " ")}</p><p className="text-[12px] text-muted-foreground">{log.user?.name ?? "System"} · {log.entityType}</p></div><span className="text-[12px] text-muted-foreground">{log.createdAt.toLocaleDateString("en-KE")}</span></div>)}</CardContent></Card>}
      {show("data") && <Card id="data"><CardHeader><CardTitle>Data & backup</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Business data remains tenant-scoped and auditable. Automated backup status and export jobs require deployment storage and a backup provider.</p></CardContent></Card>}
    </div>
  );
}