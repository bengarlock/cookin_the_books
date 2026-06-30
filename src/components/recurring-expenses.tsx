"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { DateRangePicker } from "@/components/date-range-picker";
import type { BudgetItem } from "@/lib/budget-item-types";
import { APP_BASE_PATH } from "@/lib/config";
import type { CreditCardTransaction } from "@/lib/credit-card-transaction-types";
import { budgetItemExpenseAverages } from "@/lib/expense-averages";
import {
  defaultExpenseDateRange,
  formatExpenseDateRange,
} from "@/lib/expense-date-range";
import type { ExpenseEntry } from "@/lib/expense-entry-types";
import {
  amountForBudgetPeriod,
  budgetPeriods,
  type BudgetPeriod,
} from "@/lib/budget-periods";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function todayString() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

export function RecurringExpenses({
  budgetItems,
  expenseEntries,
  creditCardTransactions,
}: {
  budgetItems: BudgetItem[];
  expenseEntries: ExpenseEntry[];
  creditCardTransactions: CreditCardTransaction[];
}) {
  const [dateRange, setDateRange] = useState(defaultExpenseDateRange);
  const today = todayString();

  const rows = useMemo(
    () =>
      budgetItems.map((item) => ({
        item,
        averages: budgetItemExpenseAverages(
          item,
          expenseEntries,
          creditCardTransactions,
          dateRange,
          today,
          budgetItems,
        ),
      })),
    [budgetItems, creditCardTransactions, dateRange, expenseEntries, today],
  );

  const totalMonthly = rows.reduce(
    (total, row) => total + row.averages.monthly,
    0,
  );
  const totalDaily = rows.reduce(
    (total, row) => total + row.averages.daily,
    0,
  );
  const totalWeekly = rows.reduce(
    (total, row) => total + row.averages.weekly,
    0,
  );
  const totalYearly = amountForBudgetPeriod(totalMonthly, "yearly");

  return (
    <div className="surface mt-8 overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Recurring expenses
          </p>
          <p className="mt-1 text-sm text-muted">
            Monthly averages from expense history for{" "}
            {formatExpenseDateRange(dateRange)}. Amounts use a four-week
            budgeting month.
          </p>
        </div>
        <Link
          className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-2.5 text-center text-sm font-semibold text-accent transition hover:bg-accent/15"
          href={`${APP_BASE_PATH}/dashboard/budget/expenses`}
        >
          Manage expenses
        </Link>
      </div>

      <div className="border-b border-white/10 bg-black/10 px-4 py-4 sm:px-5">
        <DateRangePicker range={dateRange} onApply={setDateRange} />
      </div>

      <div className="grid border-b border-white/10 sm:grid-cols-3">
        {[
          { label: "Daily average", value: totalDaily },
          { label: "Weekly average", value: totalWeekly },
          { label: "Yearly average", value: totalYearly },
        ].map((summary, index) => (
          <div
            className={`bg-white/[0.025] px-5 py-4 ${
              index > 0
                ? "border-t border-white/[0.07] sm:border-l sm:border-t-0"
                : ""
            }`}
            key={summary.label}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              {summary.label}
            </p>
            <p className="mt-2 font-mono text-xl font-semibold text-accent">
              {formatCurrency(summary.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[minmax(220px,1fr)_repeat(4,minmax(160px,0.5fr))] border-b border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <span>Expense</span>
            <span className="text-right">Weekly</span>
            <span className="text-right">Bi-Weekly</span>
            <span className="text-right">Monthly</span>
            <span className="text-right">Yearly</span>
          </div>

          {rows.map(({ item, averages }) => (
            <div
              className="grid grid-cols-[minmax(220px,1fr)_repeat(4,minmax(160px,0.5fr))] items-center border-b border-white/[0.07] px-5 py-3"
              key={item.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white/80">
                  {item.label}
                </p>
                {item.is_shared_cost ? (
                  <p className="mt-0.5 text-xs text-muted">Shared cost</p>
                ) : null}
              </div>

              {budgetPeriods.map((period: BudgetPeriod) => (
                <p
                  className="text-right font-mono text-sm text-white"
                  key={period}
                >
                  {formatCurrency(
                    amountForBudgetPeriod(averages.monthly, period),
                  )}
                </p>
              ))}
            </div>
          ))}

          {rows.length ? (
            <div className="grid grid-cols-[minmax(220px,1fr)_repeat(4,minmax(160px,0.5fr))] items-center bg-white/[0.045] px-5 py-4">
              <span className="text-sm font-semibold text-white">Total</span>
              {budgetPeriods.map((period) => (
                <span
                  className="text-right font-mono text-sm font-semibold text-accent"
                  key={period}
                >
                  {formatCurrency(amountForBudgetPeriod(totalMonthly, period))}
                </span>
              ))}
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted">
              No expenses configured yet. Add entries on the Expenses page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
