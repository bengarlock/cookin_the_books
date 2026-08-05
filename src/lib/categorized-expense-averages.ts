import { AVERAGE_DAYS_PER_MONTH } from "./expense-averages";
import type { ExpenseDateRange } from "./expense-date-range";

export type CategorizedExpenseTransaction = {
  amount: string;
  category: string;
  include: boolean;
  split: boolean;
  transaction_date: string;
  transaction_type: "purchase" | "payment" | "credit" | "fee" | "interest";
};

export type ExpenseAverages = {
  total: number;
  daily: number;
  weekly: number;
  monthly: number;
};

const expenseTransactionTypes = new Set(["purchase", "fee", "interest"]);
const excludedCategories = new Set([
  "",
  "account_payment",
  "needs_review",
  "transfer",
]);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function calendarDays(start: string, end: string) {
  const startValue = Date.parse(`${start}T00:00:00Z`);
  const endValue = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || endValue < startValue) {
    return 0;
  }
  return Math.floor((endValue - startValue) / MILLISECONDS_PER_DAY) + 1;
}

export function isCategorizedExpense(transaction: CategorizedExpenseTransaction) {
  return (
    transaction.include !== false &&
    expenseTransactionTypes.has(transaction.transaction_type) &&
    !excludedCategories.has(transaction.category)
  );
}

export function effectiveCategorizedExpenseAmount(
  transaction: CategorizedExpenseTransaction,
) {
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount)) return 0;
  return amount / (transaction.split ? 2 : 1);
}

export function categorizedExpenseAverages(
  transactions: CategorizedExpenseTransaction[],
  dateRange: ExpenseDateRange,
  today: string,
  category?: string,
): ExpenseAverages {
  const effectiveEnd = dateRange.end < today ? dateRange.end : today;
  const total = transactions
    .filter(
      (transaction) =>
        isCategorizedExpense(transaction) &&
        transaction.transaction_date >= dateRange.start &&
        transaction.transaction_date <= effectiveEnd &&
        (!category || transaction.category === category),
    )
    .reduce(
      (sum, transaction) => sum + effectiveCategorizedExpenseAmount(transaction),
      0,
    );
  const days = calendarDays(dateRange.start, effectiveEnd);
  const daily = days ? total / days : 0;

  return {
    total,
    daily,
    weekly: daily * 7,
    monthly: daily * AVERAGE_DAYS_PER_MONTH,
  };
}

export function categorizedExpenseCategories(
  transactions: CategorizedExpenseTransaction[],
  dateRange: ExpenseDateRange,
  today: string,
) {
  return Array.from(
    new Set(
      transactions
        .filter(
          (transaction) =>
            isCategorizedExpense(transaction) &&
            transaction.transaction_date >= dateRange.start &&
            transaction.transaction_date <= (dateRange.end < today ? dateRange.end : today),
        )
        .map((transaction) => transaction.category),
    ),
  ).sort((left, right) => left.localeCompare(right));
}
