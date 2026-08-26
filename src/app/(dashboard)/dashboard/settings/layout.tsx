import { requireAuthContext } from "@/server/auth/context";
import { SettingsNav } from "./settings-nav";

const SETTINGS_GROUPS = [
  {
    label: "Business",
    items: [
      { href: "/dashboard/settings", label: "General", description: "Business preferences and setup", icon: "general", permission: "SETTINGS_MANAGE", available: true },
      { href: "/dashboard/settings#business", label: "Business profile", description: "Business identity and contact details", icon: "business", permission: "SETTINGS_MANAGE", available: true },
      { href: "/dashboard/settings/branches", label: "Branches", description: "Locations, warehouses and registers", icon: "branches", permission: "BRANCHES_MANAGE", available: true },
      { href: "/dashboard/settings#locations", label: "Warehouses", description: "Stock locations by branch", icon: "warehouses", permission: "INVENTORY_VIEW", available: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/settings#registers", label: "Registers", description: "POS terminals and cash sessions", icon: "registers", permission: "SETTINGS_MANAGE", available: true },
      { href: "/dashboard/pos", label: "POS", description: "Sales and cash sessions", icon: "pos", permission: "SALES_VIEW", available: true },
      { href: "/dashboard/products", label: "Products", description: "Catalog and pricing", icon: "products", permission: "PRODUCTS_VIEW", available: true },
      { href: "/dashboard/inventory", label: "Inventory", description: "Stock and costing", icon: "inventory", permission: "INVENTORY_VIEW", available: true },
      { href: "/dashboard/customers", label: "Customers", description: "Customer accounts and credit", icon: "users", permission: "CUSTOMERS_VIEW", available: true },
    ],
  },
  {
    label: "Access",
    items: [
      { href: "/dashboard/settings/users", label: "Users & employees", description: "Team membership and branch access", icon: "users", permission: "USERS_MANAGE", available: true },
      { href: "/dashboard/settings#roles", label: "Roles & permissions", description: "Control what each role can do", icon: "roles", permission: "ROLES_MANAGE", available: true },
      { href: "/dashboard/settings#security", label: "Security", description: "Sessions and account protection", icon: "security", permission: "SETTINGS_MANAGE", available: true },
    ],
  },
  {
    label: "Finance & system",
    items: [
      { href: "/dashboard/settings#payments", label: "Payments", description: "Payment methods and providers", icon: "payments", permission: "SETTINGS_MANAGE", available: true },
      { href: "/dashboard/settings#taxes", label: "Taxes", description: "Tax rates and financial rules", icon: "taxes", permission: "SETTINGS_MANAGE", available: true },
      { href: "/dashboard/settings#receipts", label: "Receipts & invoices", description: "Receipt format and branding", icon: "receipts", permission: "SETTINGS_MANAGE", available: true },
      { href: "/dashboard/settings#notifications", label: "Notifications", description: "Alerts and business summaries", icon: "notifications", permission: "SETTINGS_MANAGE", available: true },
      { href: "/dashboard/settings#integrations", label: "Integrations", description: "Connected services", icon: "integrations", permission: "SETTINGS_MANAGE", available: true },
      { href: "/dashboard/settings#audit", label: "Audit logs", description: "Review sensitive business activity", icon: "audit", permission: "AUDIT_LOG_VIEW", available: true },
      { href: "/dashboard/settings#data", label: "Data & backup", description: "Data health and export status", icon: "data", permission: "SETTINGS_MANAGE", available: true },
      { href: "/dashboard/billing", label: "Subscription", description: "Plan, limits and billing", icon: "subscription", permission: "BILLING_MANAGE", available: true },
    ],
  },
] as const;

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuthContext();
  const groups = SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => ctx.permissions.has(item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[220px_1fr]">
      <aside className="lg:border-r lg:border-border lg:pr-5">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Control center</p>
          <h1 className="mt-1 text-xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your business workspace.</p>
        </div>
        <SettingsNav groups={groups} />
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}