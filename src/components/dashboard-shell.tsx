"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";

const navigation = [
  { name: "Overview", href: "/dashboard" },
  { name: "Accounts", href: "/dashboard/accounts" },
  { name: "Budget", href: "/dashboard/budget" },
  { name: "Snapshots", href: "/dashboard/snapshots", disabled: true },
  { name: "Automations", href: "/dashboard/automations", disabled: true },
];

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path
        d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-backdrop min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-white/10 bg-black/15 px-5 py-5 backdrop-blur lg:fixed lg:inset-y-0 lg:w-[260px] lg:border-r lg:border-b-0 lg:px-6 lg:py-7">
        <div className="flex items-center justify-between lg:block">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl border border-accent/25 bg-accent/10 font-bold text-accent">
              C
            </div>
            <div>
              <p className="font-semibold text-white">Cookin&apos; the Books</p>
              <p className="text-xs text-muted">Financial command center</p>
            </div>
          </div>
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </div>

        <nav className="mt-5 flex gap-2 overflow-x-auto lg:mt-10 lg:block lg:space-y-2">
          {navigation.map((item) =>
            item.disabled ? (
              <span
                key={item.name}
                className="flex shrink-0 cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/30 lg:w-full"
              >
                <GridIcon />
                {item.name}
                <span className="ml-auto hidden text-[10px] uppercase tracking-wider lg:inline">
                  Soon
                </span>
              </span>
            ) : (
              <Link
                key={item.name}
                href={item.href}
                className={`flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition lg:w-full ${
                  pathname === item.href
                    ? "border-accent/15 bg-accent/10 text-accent"
                    : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <GridIcon />
                {item.name}
              </Link>
            ),
          )}
        </nav>

        <div className="absolute bottom-7 left-6 right-6 hidden lg:block">
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              API source
            </p>
            <p className="mt-2 text-sm text-white/80">portfolio_database</p>
            <p className="mt-1 text-xs text-muted">Authenticated connection</p>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="flex min-h-20 items-center justify-between border-b border-white/10 bg-[#07100f]/70 px-5 backdrop-blur sm:px-8 lg:px-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Dashboard
            </p>
            <p className="mt-1 text-sm text-white/75">
              Your financial tools, one workspace
            </p>
          </div>
        </header>

        <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
