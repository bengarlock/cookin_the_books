import type { BudgetItem } from "./budget-item-types";
import { creditCardExpenditureAverages } from "./credit-card-averages";
import type { CreditCardTransaction } from "./credit-card-transaction-types";
import type { ExpenseDateRange } from "./expense-date-range";
import type { ExpenseEntry } from "./expense-entry-types";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const AVERAGE_DAYS_PER_MONTH = 365.2425 / 12;

export { AVERAGE_DAYS_PER_MONTH };

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

function adjustExpenseAveragesForDeduction(
  averages: { total: number; daily: number; weekly: number; monthly: number },
  deduction: number,
) {
  if (deduction <= 0) return averages;

  const total = Math.max(0, averages.total - deduction);
  if (averages.daily === 0) {
    return { total, daily: 0, weekly: 0, monthly: 0 };
  }

  const days = averages.total / averages.daily;
  const daily = days > 0 ? total / days : 0;

  return {
    total,
    daily,
    weekly: daily * 7,
    monthly: daily * AVERAGE_DAYS_PER_MONTH,
  };
}

export function creditCardExclusionTotal(
  entries: ExpenseEntry[],
  budgetItemsById: Map<number, BudgetItem>,
  dateRange: ExpenseDateRange,
  today: string,
) {
  const effectiveEnd = dateRange.end < today ? dateRange.end : today;

  return entries
    .filter(
      (entry) =>
        (entry.exclude_from_credit_card ?? false) &&
        entry.incurred_on >= dateRange.start &&
        entry.incurred_on <= effectiveEnd,
    )
    .reduce((sum, entry) => {
      const budgetItem = budgetItemsById.get(entry.budget_item);
      return (
        sum +
        effectiveExpenseAmount(entry.amount, budgetItem?.is_shared_cost ?? false)
      );
    }, 0);
}

export function budgetItemExpenseAverages(
  item: BudgetItem,
  entries: ExpenseEntry[],
  creditCardTransactions: CreditCardTransaction[],
  dateRange: ExpenseDateRange,
  today: string,
  budgetItems: BudgetItem[] = [],
) {
  const relevantEntries = entries.filter(
    (entry) =>
      entry.budget_item === item.id &&
      entry.incurred_on >= dateRange.start &&
      entry.incurred_on <= dateRange.end,
  );
  const itemCreditCardTransactions = creditCardTransactions.filter(
    (transaction) =>
      item.key === "credit-card" &&
      transaction.budget_item === item.id &&
      transaction.transaction_date >= dateRange.start &&
      transaction.transaction_date <= dateRange.end,
  );
  const creditCardAverages = adjustExpenseAveragesForDeduction(
    scaleExpenseAverages(
      creditCardExpenditureAverages(
        itemCreditCardTransactions,
        dateRange.start,
        dateRange.end,
      ),
      item.is_shared_cost,
    ),
    item.key === "credit-card"
      ? creditCardExclusionTotal(
          entries,
          new Map(budgetItems.map((budgetItem) => [budgetItem.id, budgetItem])),
          dateRange,
          today,
        )
      : 0,
  );
  const entryAverages = expenseEntryAverages(
    relevantEntries,
    dateRange.start,
    dateRange.end,
    today,
    item.is_shared_cost,
  );

  return item.key === "credit-card" ? creditCardAverages : entryAverages;
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
