"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DateRangePicker } from "@/components/date-range-picker";
import {
  expenseDateRangeFromSearchParams,
  type ExpenseDateRange,
} from "@/lib/expense-date-range";

const goalsPath = "/dashboard/budget/goals";

export function BudgetDateRangePicker() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  if (pathname === goalsPath) return null;

  const range = expenseDateRangeFromSearchParams({
    start: searchParams.get("start") || undefined,
    end: searchParams.get("end") || undefined,
  });

  function applyRange(nextRange: ExpenseDateRange) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("start", nextRange.start);
    nextParams.set("end", nextRange.end);
    router.replace(`${pathname}?${nextParams}`, { scroll: false });
  }

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
