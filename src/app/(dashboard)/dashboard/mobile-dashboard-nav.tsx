"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { DashboardNavItem } from "./dashboard-nav";
import { DashboardNav } from "./dashboard-nav";

export function MobileDashboardNav({ items }: { items: DashboardNavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      >
        <Menu size={18} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="mobile-nav-backdrop absolute inset-0 bg-foreground/30"
          />
          <aside className="mobile-nav-panel relative h-full w-[min(86vw,320px)] overflow-y-auto bg-surface px-4 py-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
              <Link href="/dashboard" onClick={() => setOpen(false)} className="text-sm font-bold tracking-[0.15em]">DUKAOS</Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <DashboardNav items={items} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
