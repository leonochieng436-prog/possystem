import { redirect } from "next/navigation";
import { AuthError, requireAuthContext } from "@/server/auth/context";
import { rawPrisma } from "@/server/db/client";
import { logout } from "@/app/actions/auth";
import { DashboardNav, type DashboardNavItem } from "./dashboard/dashboard-nav";
import { MobileDashboardNav } from "./dashboard/mobile-dashboard-nav";
import {
  LogOut,
  Store,
} from "lucide-react";

const NAV: DashboardNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/pos", label: "POS", icon: "pos" },
  { href: "/dashboard/products", label: "Products", icon: "products" },
  { href: "/dashboard/inventory", label: "Inventory", icon: "inventory", children: [
    { href: "/dashboard/inventory", label: "Overview" },
    { href: "/dashboard/inventory#stock-levels", label: "Stock levels" },
    { href: "/dashboard/inventory#movements", label: "Stock movements" },
    { href: "/dashboard/inventory#alerts", label: "Restock attention" },
    { href: "/dashboard/inventory#edit-inventory", label: "Adjust stock" },
  ] },
  { href: "/dashboard/purchases", label: "Purchases", icon: "purchases" },
  { href: "/dashboard/credit", label: "Credit", icon: "customers" },
  { href: "/dashboard/customers", label: "Customers", icon: "customers" },
  { href: "/dashboard/expenses", label: "Expenses", icon: "expenses" },
  { href: "/dashboard/reports", label: "Reports", icon: "reports" },
  { href: "/dashboard/billing", label: "Billing", icon: "billing" },
  { href: "/dashboard/settings/branches", label: "Settings", icon: "settings" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch (e) {
    if (e instanceof AuthError) redirect("/login");
    throw e;
  }

  const [organization, user, branchCount] = await Promise.all([
    rawPrisma.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
    }),
    rawPrisma.user.findUniqueOrThrow({ where: { id: ctx.userId } }),
    ctx.db.branch.count({ where: { isActive: true } }),
  ]);
  const canOpenSettings = [
    "SETTINGS_MANAGE",
    "BRANCHES_MANAGE",
    "USERS_MANAGE",
    "ROLES_MANAGE",
    "AUDIT_LOG_VIEW",
  ].some((permission) => ctx.permissions.has(permission));
  const adminNav = NAV.slice(9).filter((item) =>
    item.href === "/dashboard/billing"
      ? ctx.permissions.has("BILLING_MANAGE")
      : canOpenSettings
  );

  return (
    <div className="min-h-screen bg-background lg:h-screen lg:overflow-hidden lg:grid lg:grid-cols-[252px_1fr]">
      <aside className="scrollbar-hidden hidden border-r border-border bg-surface lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto">
        <div className="border-b border-border px-5 py-5">
          <div className="flex items-center gap-3">
            <img src="/images/DukaOS-logo2.png" alt="DukaOS logo" className="h-12 w-auto object-contain" />
          </div>
          <div className="mt-5 rounded-[var(--radius-md)] border border-border bg-background px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Workspace</p>
            <p className="mt-1 truncate text-sm font-semibold">{organization.name}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Retail &amp; Business Management</p>
          </div>
        </div>
        <div className="flex-1 px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
          <DashboardNav items={NAV.slice(0, 9)} />
          <p className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Administration</p>
          <DashboardNav items={adminNav} />
        </div>
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-[12px] text-muted-foreground">
                {organization.name}
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Log out"
                className="rounded-[var(--radius-sm)] p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col lg:h-screen">
        <header className="flex h-[72px] items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <img src="/images/DukaOS-logo2.png" alt="DukaOS logo" className="h-8 w-auto object-contain" />
          </div>
          <div className="hidden lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{organization.name}</p>
            <p className="text-sm font-semibold">All Branches <span className="font-normal text-muted-foreground">· {branchCount} active location{branchCount === 1 ? "" : "s"}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right sm:block"><span className="block text-sm font-semibold">{user.name}</span><span className="block text-[11px] text-muted-foreground">Owner</span></span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-tint text-sm font-bold text-primary">{user.name.slice(0, 1).toUpperCase()}</span>
            <MobileDashboardNav items={NAV.slice(0, 9)} />
          </div>
        </header>
        <main className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
