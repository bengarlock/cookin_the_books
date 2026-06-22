"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const budgetLinks = [
  { href: "/dashboard/budget", label: "Plan" },
  { href: "/dashboard/budget/expenses", label: "Expenses" },
];

export function BudgetNavigation() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex gap-2" aria-label="Budget sections">
      {budgetLinks.map((link) => (
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
