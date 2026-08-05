"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { DateRangePicker } from "@/components/date-range-picker";
import { useLiveSnapshot } from "@/components/live-snapshot-provider";
import type { BudgetPlanSettings } from "@/lib/budget-plan-settings-types";
import { APP_BASE_PATH } from "@/lib/config";
import {
  categorizedExpenseAverages,
  categorizedExpenseCategories,
  type SupplementalCategorizedExpense,
} from "@/lib/categorized-expense-averages";
import type { ExpenseCategory } from "@/lib/expense-category-types";
import {
  formatExpenseDateRange,
  type ExpenseDateRange,
} from "@/lib/expense-date-range";
import type {
  ExpenseTransaction,
  IncomeTransaction,
} from "@/lib/credit-card-transaction-types";
import type { IncomeEntry } from "@/lib/income-entry-types";
import type { PendingTransaction } from "@/lib/pending-transaction-types";
import {
  projectDateRange,
  projectRevenueAfterPayCycle,
} from "@/lib/projections";
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
  budgetPlanSettings,
  categories,
  incomeEntries,
  incomeTransactions,
  pendingTransactions,
  propertyTaxExpenses,
  initialRange,
  transactions,
}: {
  budgetPlanSettings: BudgetPlanSettings;
  categories: ExpenseCategory[];
  incomeEntries: IncomeEntry[];
  incomeTransactions: IncomeTransaction[];
  pendingTransactions: PendingTransaction[];
  propertyTaxExpenses: SupplementalCategorizedExpense[];
  initialRange: ExpenseDateRange;
  transactions: ExpenseTransaction[];
}) {
  const [dateRange, setDateRange] = useState(initialRange);
  const pathname = usePathname();
  const router = useRouter();
  const { snapshot } = useLiveSnapshot();
  const today = todayString();
  const categoryRows = useMemo(
    () =>
      categorizedExpenseCategories(transactions, dateRange, today, propertyTaxExpenses)
        .map((category) => ({
          category,
          averages: categorizedExpenseAverages(
            transactions,
            dateRange,
            today,
            category,
            propertyTaxExpenses,
          ),
        }))
        .sort((left, right) => right.averages.monthly - left.averages.monthly),
    [dateRange, propertyTaxExpenses, today, transactions],
  );
  const total = categorizedExpenseAverages(
    transactions,
    dateRange,
    today,
    undefined,
    propertyTaxExpenses,
  );
  const rangeProjection = useMemo(
    () =>
      projectDateRange({
        incomeEntries,
        categorizedTransactions: transactions,
        supplementalExpenses: propertyTaxExpenses,
        incomeTransactions,
        dateRange,
        nextPaydayOverride: budgetPlanSettings.next_payday_override,
      }),
    [budgetPlanSettings.next_payday_override, dateRange, incomeEntries, incomeTransactions, propertyTaxExpenses, transactions],
  );
  const payCycleProjection = useMemo(
    () =>
      projectRevenueAfterPayCycle({
        incomeEntries,
        budgetItems: [],
        expenseEntries: [],
        creditCardTransactions: [],
        categorizedTransactions: transactions,
        supplementalExpenses: propertyTaxExpenses,
        pendingTransactions,
        snapshot,
        nextPaydayOverride: budgetPlanSettings.next_payday_override,
      }),
    [budgetPlanSettings.next_payday_override, incomeEntries, pendingTransactions, propertyTaxExpenses, snapshot, transactions],
  );

  function applyDateRange(nextRange: ExpenseDateRange) {
    setDateRange(nextRange);
    router.replace(`${pathname}?${new URLSearchParams(nextRange)}`);
  }

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
          <DateRangePicker range={dateRange} onApply={applyDateRange} />
          <Link
            className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-2.5 text-center text-sm font-semibold text-accent transition hover:bg-accent/15"
            href={`${APP_BASE_PATH}/dashboard/budget/expenses`}
          >
            Review transactions
          </Link>
        </div>
      </div>

      <section className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 bg-white/[0.045] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Selected-period outlook</p>
          <p className="mt-1 text-sm text-muted">Actual income and spending for {formatExpenseDateRange(dateRange)}, plus a forecast for any days still ahead.</p>
        </div>
        <BudgetTable
          rows={[
            ["Income", rangeProjection.actualIncome, rangeProjection.forecastIncome, rangeProjection.projectedIncome],
            ["Expenses", -rangeProjection.actualExpenses, -rangeProjection.forecastExpenses, -rangeProjection.projectedExpenses],
            ["Net gain / loss", rangeProjection.actualIncome - rangeProjection.actualExpenses, rangeProjection.forecastIncome - rangeProjection.forecastExpenses, rangeProjection.projectedNet],
          ]}
          headings={["Actual", "Forecast", "Selected-period projection"]}
        />
      </section>

      <section className="surface mt-5 overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 bg-white/[0.045] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Expense categories</p>
          <p className="mt-1 text-sm text-muted">Included categorized transactions for the selected period.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="border-b border-white/[0.07] text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              <tr><th className="px-5 py-3">Category</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3 text-right">Daily</th><th className="px-5 py-3 text-right">Monthly average</th><th className="px-5 py-3 text-right">Annual pace</th></tr>
            </thead>
            <tbody>
              {categoryRows.map(({ category, averages }) => (
                <tr className="border-b border-white/[0.07]" key={category}>
                  <th className="px-5 py-3 text-sm font-medium text-white/80">{labelForCategory(category, categories)}</th>
                  <td className="px-5 py-3 text-right font-mono text-sm text-white">{currencyFormatter.format(averages.total)}</td>
                  <td className="px-5 py-3 text-right font-mono text-sm text-white">{currencyFormatter.format(averages.daily)}</td>
                  <td className="px-5 py-3 text-right font-mono text-sm text-white">{currencyFormatter.format(averages.monthly)}</td>
                  <td className="px-5 py-3 text-right font-mono text-sm text-white">{currencyFormatter.format(averages.monthly * 12)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-white/[0.045] font-semibold">
              <tr><th className="px-5 py-4 text-sm text-white">All categories</th><td className="px-5 py-4 text-right font-mono text-sm text-accent">{currencyFormatter.format(total.total)}</td><td className="px-5 py-4 text-right font-mono text-sm text-accent">{currencyFormatter.format(total.daily)}</td><td className="px-5 py-4 text-right font-mono text-sm text-accent">{currencyFormatter.format(total.monthly)}</td><td className="px-5 py-4 text-right font-mono text-sm text-accent">{currencyFormatter.format(total.monthly * 12)}</td></tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="surface mt-5 overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 bg-white/[0.045] px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Current pay cycle</p><p className="mt-1 text-sm text-muted">{payCycleProjection.daysRemaining} days until {payCycleProjection.nextPaydayLabel}.</p></div>
        <BudgetTable rows={[["Projected paycheck", payCycleProjection.predictedNextPaycheck], ["Spent so far", -payCycleProjection.spentThisPayCycle], ["Expected additional spend", -payCycleProjection.predictedAdditionalSpend], ["Projected cash after payday", payCycleProjection.projectedCashAfterPayCycle]]} headings={["Amount"]} />
      </section>

      {!categoryRows.length ? (
        <p className="surface mt-5 rounded-2xl px-5 py-10 text-center text-sm text-muted">
          No categorized expenses in this date range. Review transactions to assign categories.
        </p>
      ) : null}
    </section>
  );
}

function BudgetTable({
  headings,
  rows,
}: {
  headings: string[];
  rows: [string, ...number[]][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left">
        <thead className="border-b border-white/[0.07] text-[10px] font-semibold uppercase tracking-[0.16em] text-muted"><tr><th className="px-5 py-3">Metric</th>{headings.map((heading) => <th className="px-5 py-3 text-right" key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{rows.map(([label, ...values]) => <tr className="border-b border-white/[0.07] last:border-b-0" key={label}><th className="px-5 py-3 text-sm font-medium text-white/80">{label}</th>{values.map((value, index) => <td className={`px-5 py-3 text-right font-mono text-sm ${value < 0 ? "text-rose-300" : "text-white"}`} key={index}>{value < 0 ? "−" : ""}{currencyFormatter.format(Math.abs(value))}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
