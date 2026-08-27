"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Archive,
  Banknote,
  Bell,
  Building2,
  CreditCard,
  FileText,
  HardDrive,
  KeyRound,
  Package,
  Receipt,
  Settings2,
  ShieldCheck,
  Store,
  Users,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsItem = {
  href: string;
  label: string;
  description: string;
  icon: string;
  available: boolean;
};

const ICONS = {
  general: Settings2,
  business: Building2,
  branches: Store,
  warehouses: Warehouse,
  registers: CreditCard,
  users: Users,
  roles: KeyRound,
  security: ShieldCheck,
  pos: Banknote,
  payments: CreditCard,
  taxes: Receipt,
  receipts: FileText,
  products: Package,
  inventory: Archive,
  notifications: Bell,
  integrations: Store,
  audit: FileText,
  data: HardDrive,
  subscription: CreditCard,
} as const;

export function SettingsNav({ groups }: { groups: { label: string; items: SettingsItem[] }[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSection = searchParams.get("section");

  return (
    <nav className="space-y-6" aria-label="Settings navigation">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon as keyof typeof ICONS];
              const itemUrl = new URL(item.href, "http://settings.local");
              const active = pathname === itemUrl.pathname && (itemUrl.searchParams.get("section") ?? null) === activeSection;
              if (!item.available) {
                return (
                  <div key={item.label} className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground/60">
                    <Icon size={16} />
                    <span>{item.label}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-wide">Soon</span>
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_5px_14px_rgba(15,123,108,0.18)]"
                      : "text-foreground/70 hover:bg-surface-muted hover:text-foreground"
                  )}
                  title={item.description}
                >
                  <Icon size={16} className={active ? "" : "text-muted-foreground group-hover:text-primary"} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}