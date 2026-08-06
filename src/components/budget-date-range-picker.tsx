"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DateRangePicker } from "@/components/date-range-picker";
import {
  defaultExpenseDateRange,
  expenseDateRangeFromSearchParams,
  isExpenseDateRange,
  type ExpenseDateRange,
} from "@/lib/expense-date-range";

const goalsPath = "/dashboard/budget/goals";
const storageKey = "cookin-the-books:budget-date-range";

function storedRange() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || "null");
    return typeof value === "object" && value !== null && isExpenseDateRange(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function BudgetDateRangePicker() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGoalsPage = pathname === goalsPath;
  const start = searchParams.get("start") || "";
  const end = searchParams.get("end") || "";
  const urlRange = useMemo(
    () => (isExpenseDateRange({ start, end }) ? { start, end } : null),
    [end, start],
  );
  const range = urlRange || expenseDateRangeFromSearchParams({});
  const rangeKey = urlRange ? `${urlRange.start}:${urlRange.end}` : "";

  useEffect(() => {
    if (isGoalsPage) return;

    if (urlRange) {
      localStorage.setItem(storageKey, JSON.stringify(urlRange));
      return;
    }

    const savedRange = storedRange();
    if (savedRange) {
      router.replace(
        `${pathname}?${new URLSearchParams(savedRange)}`,
        { scroll: false },
      );
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(defaultExpenseDateRange()));
  }, [isGoalsPage, pathname, rangeKey, router, urlRange]);

  function applyRange(nextRange: ExpenseDateRange) {
    localStorage.setItem(storageKey, JSON.stringify(nextRange));
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("start", nextRange.start);
    nextParams.set("end", nextRange.end);
    router.replace(`${pathname}?${nextParams}`, { scroll: false });
  }

  if (isGoalsPage) return null;

  return (
    <div className="mb-6 flex justify-center">
      <DateRangePicker
        dialogLabel="Select Budget date range"
        onApply={applyRange}
        range={range}
        triggerClassName="inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-4 py-2.5 text-center text-sm font-medium text-white/75 transition hover:border-accent/25 hover:text-accent"
      />
    </div>
  );
}
