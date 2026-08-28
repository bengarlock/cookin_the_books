import { cashAccountIncomeTransactions } from "./cash-account-ledgers";
import {
  effectiveCategorizedExpenseAmount,
  isCategorizedExpense,
} from "./categorized-expense-averages";
import type {
  ExpenseTransaction,
  IncomeTransaction,
} from "./credit-card-transaction-types";
import type { IncomeEntry } from "./income-entry-types";
import { reconcileSyncedIncome } from "./income-reconciliation";

export type FinancialCalendarActivity = {
  key: string;
  date: string;
  title: string;
  amount: string;
  kind: "income" | "spend";
};

function amountCents(amount: string) {
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) return BigInt(0);
  const cents =
    BigInt(match[2]) * BigInt(100) +
    BigInt((match[3] ?? "").padEnd(2, "0"));
  return match[1] === "-" ? -cents : cents;
}

export function financialCalendarActivityCents(
  activity: FinancialCalendarActivity,
) {
  const cents = amountCents(activity.amount);
  if (activity.kind === "income") {
    return cents < BigInt(0) ? -cents : cents;
  }
  return -cents;
}

export function financialCalendarDayActivityTotalCents(
  activities: FinancialCalendarActivity[],
) {
  return activities.reduce(
    (total, activity) => total + financialCalendarActivityCents(activity),
    BigInt(0),
  );
}

export function financialCalendarActivities(
  expenses: ExpenseTransaction[],
  income: IncomeTransaction[],
  incomeEntries: IncomeEntry[] = [],
) {
  const expenseActivity: FinancialCalendarActivity[] = expenses
    .filter(isCategorizedExpense)
    .map((transaction) => ({
      key: `spend-${transaction.id}`,
      date: transaction.transaction_date,
      title: transaction.description,
      amount: effectiveCategorizedExpenseAmount(transaction).toFixed(2),
      kind: "spend",
    }));
  const reconciledIncome = reconcileSyncedIncome(
    incomeEntries,
    cashAccountIncomeTransactions(income, { includeExcluded: true }),
  );
  const statementIncomeActivity: FinancialCalendarActivity[] = incomeEntries
    .filter((entry) => Number(entry.net_pay) > 0)
    .map((entry) => ({
      key: `income-entry-${entry.id}`,
      date: entry.pay_date,
      title: entry.employer || "Income",
      amount: entry.net_pay,
      kind: "income",
    }));
  const syncedIncomeActivity: FinancialCalendarActivity[] =
    reconciledIncome.unmatchedTransactions
      .filter((transaction) => transaction.include !== false)
      .map((transaction) => ({
      key: `income-${transaction.id}`,
      date: transaction.transaction_date,
      title: transaction.description,
      amount: transaction.amount,
      kind: "income",
    }));

  return [
    ...expenseActivity,
    ...statementIncomeActivity,
    ...syncedIncomeActivity,
  ].sort(
    (left, right) =>
      left.date.localeCompare(right.date) || left.key.localeCompare(right.key),
  );
}
