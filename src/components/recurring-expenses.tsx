"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { DateRangePicker } from "@/components/date-range-picker";
import { APP_BASE_PATH } from "@/lib/config";
import {
  categorizedExpenseAverages,
  categorizedExpenseCategories,
} from "@/lib/categorized-expense-averages";
import type { ExpenseCategory } from "@/lib/expense-category-types";
import {
  defaultExpenseDateRange,
  formatExpenseDateRange,
} from "@/lib/expense-date-range";
import type { ExpenseTransaction } from "@/lib/credit-card-transaction-types";
import { labelForCategory } from "@/lib/transaction-categories";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function todayString() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

export function RecurringExpenses({
  categories,
  transactions,
}: {
  categories: ExpenseCategory[];
  transactions: ExpenseTransaction[];
}) {
  const [dateRange, setDateRange] = useState(defaultExpenseDateRange);
  const today = todayString();
  const categoryRows = useMemo(
    () =>
      categorizedExpenseCategories(transactions, dateRange, today)
        .map((category) => ({
          category,
          averages: categorizedExpenseAverages(
            transactions,
            dateRange,
            today,
            category,
          ),
        }))
        .sort((left, right) => right.averages.monthly - left.averages.monthly),
    [dateRange, today, transactions],
  );
  const total = categorizedExpenseAverages(transactions, dateRange, today);

  return (
    <section className="mt-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Expense categories
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Spending from categorized transactions
          </h2>
          <p className="mt-1 text-sm text-muted">
            {formatExpenseDateRange(dateRange)} · included transactions only.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker range={dateRange} onApply={setDateRange} />
          <Link
            className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-2.5 text-center text-sm font-semibold text-accent transition hover:bg-accent/15"
            href={`${APP_BASE_PATH}/dashboard/budget/expenses`}
          >
            Review transactions
          </Link>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <article className="dashboard-tile rounded-2xl border border-accent/25 bg-accent/[0.09] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            All categories
          </p>
          <p className="mt-4 font-mono text-3xl font-semibold tracking-tight text-white">
            {currencyFormatter.format(total.monthly)}
          </p>
          <p className="mt-3 text-xs leading-5 text-muted">
            Monthly average · {currencyFormatter.format(total.daily)} per day
          </p>
        </article>
        {categoryRows.map(({ category, averages }) => (
          <article
            className="dashboard-tile rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
            key={category}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              {labelForCategory(category, categories)}
            </p>
            <p className="mt-4 font-mono text-3xl font-semibold tracking-tight text-white">
              {currencyFormatter.format(averages.monthly)}
            </p>
            <p className="mt-3 text-xs leading-5 text-muted">
              {currencyFormatter.format(averages.total)} total · {currencyFormatter.format(averages.daily)} per day
            </p>
          </article>
        ))}
      </div>

      {!categoryRows.length ? (
        <p className="surface mt-5 rounded-2xl px-5 py-10 text-center text-sm text-muted">
          No categorized expenses in this date range. Review transactions to assign categories.
        </p>
      ) : null}
    </section>
  );
}
