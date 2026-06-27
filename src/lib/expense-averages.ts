import type { ExpenseEntry } from "@/lib/expense-entry-types";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const AVERAGE_DAYS_PER_MONTH = 365.2425 / 12;

export function effectiveExpenseAmount(
  amount: string | number,
  isSharedCost: boolean,
) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return isSharedCost ? value / 2 : value;
}

export function scaleExpenseAverages<
  T extends { total: number; daily: number; weekly: number; monthly: number },
>(averages: T, isSharedCost: boolean) {
  if (!isSharedCost) return averages;

  return {
    ...averages,
    total: averages.total / 2,
    daily: averages.daily / 2,
    weekly: averages.weekly / 2,
    monthly: averages.monthly / 2,
  };
}

function dateValue(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

function calendarDays(start: string, end: string) {
  const startValue = dateValue(start);
  const endValue = dateValue(end);
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) return 0;
  if (endValue < startValue) return 0;
  return Math.floor((endValue - startValue) / MILLISECONDS_PER_DAY) + 1;
}

export function expenseEntryAverages(
  entries: ExpenseEntry[],
  startDate: string,
  endDate: string,
  today: string,
  isSharedCost = false,
) {
  const effectiveEnd = endDate < today ? endDate : today;
  const expenditures = entries.filter(
    (entry) =>
      entry.incurred_on >= startDate && entry.incurred_on <= effectiveEnd,
  );
  const total = expenditures.reduce(
    (sum, entry) => sum + effectiveExpenseAmount(entry.amount, isSharedCost),
    0,
  );
  const days = calendarDays(startDate, effectiveEnd);
  const daily = days > 0 ? total / days : 0;

  return {
    total,
    daily,
    weekly: daily * 7,
    monthly: daily * AVERAGE_DAYS_PER_MONTH,
  };
}
