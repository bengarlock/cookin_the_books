"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const settingsLinks = [
  { href: "/dashboard/settings/appearance", label: "Appearance" },
  { href: "/dashboard/settings/amazon-data", label: "Amazon data" },
  { href: "/dashboard/settings/receipts", label: "Receipts" },
  { href: "/dashboard/settings/categories", label: "Categories" },
  { href: "/dashboard/settings/connected-accounts", label: "Connected accounts" },
  { href: "/dashboard/settings/sync-activity", label: "Sync activity" },
];

export function SettingsNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Settings sections">
      {settingsLinks.map((link) => (
        <Link
          className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
            pathname === link.href
              ? "border-accent/20 bg-accent/10 text-accent"
              : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white"
          }`}
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
