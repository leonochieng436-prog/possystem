"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  children?: { href: string; label: string }[];
};

const ICONS = {
  dashboard: LayoutDashboard,
  pos: ShoppingCart,
  products: Package,
  inventory: Boxes,
  purchases: Truck,
  customers: Users,
  expenses: Wallet,
  reports: BarChart3,
  billing: Wallet,
  settings: Settings,
} as const;

export function DashboardNav({ items, onNavigate }: { items: DashboardNavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = item.href === "/dashboard"
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = ICONS[item.icon];
        return (
          <div key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-[0_5px_14px_rgba(15,123,108,0.18)]"
                  : "text-foreground/70 hover:bg-surface-muted hover:text-foreground"
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.4 : 2} className={active ? "" : "text-muted-foreground group-hover:text-primary"} />
              <span>{item.label}</span>
            </Link>
            {active && item.children && <div className="ml-8 mt-1 space-y-0.5 border-l border-border pl-3">
              {item.children.map((child) => <Link key={child.href} href={child.href} onClick={onNavigate} className="block rounded px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-surface-muted hover:text-foreground">{child.label}</Link>)}
            </div>}
          </div>
        );
      })}
    </nav>
  );
}
