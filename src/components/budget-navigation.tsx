"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const budgetLinks = [
  { href: "/dashboard/budget", label: "Plan" },
  { href: "/dashboard/budget/income", label: "Income" },
  { href: "/dashboard/budget/expenses", label: "Expenses" },
  { href: "/dashboard/budget/projections", label: "Projections" },
  { href: "/dashboard/budget/goals", label: "Goals" },
];

const fullyPrefetchedBudgetHrefs = new Set([
  "/dashboard/budget",
  "/dashboard/budget/income",
]);

export function BudgetNavigation({
  activePathname,
}: {
  activePathname?: string;
} = {}) {
  const currentPathname = usePathname();
  const pathname = activePathname ?? currentPathname;
  const searchParams = useSearchParams();
  const dateRangeQuery = new URLSearchParams();
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (start && end) {
    dateRangeQuery.set("start", start);
    dateRangeQuery.set("end", end);
  }

  return (
    <nav
      className="flex flex-wrap justify-center gap-2 sm:justify-start"
      aria-label="Budget sections"
    >
      {budgetLinks.map((link) => (
        <Link
          className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
            pathname === link.href
              ? "border-accent/20 bg-accent/10 text-accent"
              : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white"
          }`}
          href={
            link.href === "/dashboard/budget/goals" || !dateRangeQuery.size
              ? link.href
              : `${link.href}?${dateRangeQuery}`
          }
          key={link.href}
          prefetch={fullyPrefetchedBudgetHrefs.has(link.href)}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
