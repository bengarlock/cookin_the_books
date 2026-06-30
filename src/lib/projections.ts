import type { IncomeEntry } from "./income-entry-types";
import { defaultExpenseDateRange, localDateString } from "./expense-date-range";
import type { PendingTransaction } from "./pending-transaction-types";
import { formatPayday, getNextPayCycle, remainingPaydaysInYear } from "./pay-cycle";
import type { BankValueSnapshot, SnapshotAccountKey } from "./snapshot-types";
import type { BudgetItem } from "./budget-item-types";
import {
  AVERAGE_DAYS_PER_MONTH,
  budgetItemExpenseAverages,
} from "./expense-averages";
import type { CreditCardTransaction } from "./credit-card-transaction-types";
import type { ExpenseEntry } from "./expense-entry-types";

const LIABILITY_ACCOUNTS: SnapshotAccountKey[] = [
  "chase_credit",
  "citi_current",
  "citi_pending",
  "barclays_card",
];

const LIABILITY_LABELS: Record<SnapshotAccountKey, string> = {
  chase_checking: "Chase Checking",
  chase_savings: "Chase Savings",
  chase_credit: "Chase Mastercard",
  citi_current: "Citi Card — Current",
  citi_pending: "Citi Card — Pending",
  barclays_card: "Barclaycard",
  etrade: "E*TRADE",
  betterment_general: "Betterment — General",
  betterment_safety: "Betterment — Safety Net",
  betterment_retirement: "Betterment — Retirement",
  fidelity_retirement: "Fidelity 401(k)",
};

export type ClassifiedPaycheck = {
  entry: IncomeEntry;
  classification: "normal" | "bonus";
  netPay: number;
};

export type PaycheckProjection = {
  predictedNetPay: number;
  normalPaychecks: ClassifiedPaycheck[];
  bonusPaychecks: ClassifiedPaycheck[];
  lookbackStart: string;
  lookbackEnd: string;
};

export type LiabilityBreakdown = {
  account: SnapshotAccountKey;
  label: string;
  amount: number;
};

export type PayCycleProjection = {
  nextPayday: Date;
  nextPaydayLabel: string;
  daysRemaining: number;
  predictedNextPaycheck: number;
  dailyAverageExpense: number;
  predictedSpend: number;
  creditCardPayoff: number;
  liabilityBreakdown: LiabilityBreakdown[];
  projectedCashAfterPayCycle: number;
  paycheckProjection: PaycheckProjection;
};

export type CurrentYearProjection = {
  year: number;
  ytdIncome: number;
  forecastIncome: number;
  projectedIncome: number;
  ytdExpenses: number;
  forecastExpenses: number;
  projectedExpenses: number;
  projectedNet: number;
  remainingPaydays: number;
  predictedPaycheck: number;
  remainingDays: number;
};

function oneYearAgo(currentDate: Date) {
  const past = new Date(
    currentDate.getFullYear() - 1,
    currentDate.getMonth(),
    currentDate.getDate(),
  );
  return localDateString(past);
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];

  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return percentile(sorted, 0.5);
}

export function incomeEntriesInLookback(
  entries: IncomeEntry[],
  currentDate = new Date(),
  lookbackDays = 365,
) {
  const lookbackStart =
    lookbackDays === 365
      ? oneYearAgo(currentDate)
      : localDateString(
          new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate() - lookbackDays,
          ),
        );
  const lookbackEnd = localDateString(currentDate);

  return entries
    .filter(
      (entry) =>
        entry.pay_date >= lookbackStart && entry.pay_date <= lookbackEnd,
    )
    .sort((left, right) => left.pay_date.localeCompare(right.pay_date));
}

export function classifyPaychecks(
  entries: IncomeEntry[],
  currentDate = new Date(),
): PaycheckProjection {
  const recentEntries = incomeEntriesInLookback(entries, currentDate);
  const lookbackStart = oneYearAgo(currentDate);
  const lookbackEnd = localDateString(currentDate);

  if (!recentEntries.length) {
    return {
      predictedNetPay: 0,
      normalPaychecks: [],
      bonusPaychecks: [],
      lookbackStart,
      lookbackEnd,
    };
  }

  const netPays = recentEntries.map((entry) => Number(entry.net_pay));
  const sortedNetPays = [...netPays].sort((left, right) => left - right);
  const q1 = percentile(sortedNetPays, 0.25);
  const q3 = percentile(sortedNetPays, 0.75);
  const medianNet = percentile(sortedNetPays, 0.5);
  const upperFence = q3 + 1.5 * (q3 - q1);

  const normalPaychecks: ClassifiedPaycheck[] = [];
  const bonusPaychecks: ClassifiedPaycheck[] = [];

  for (const entry of recentEntries) {
    const netPay = Number(entry.net_pay);
    const isHighOutlier = netPay > upperFence;
    const isBonusSized = netPay > medianNet * 1.35 && netPay > q3;
    const classification =
      isHighOutlier || isBonusSized ? "bonus" : "normal";
    const classified = { entry, classification, netPay } as const;

    if (classification === "bonus") {
      bonusPaychecks.push(classified);
    } else {
      normalPaychecks.push(classified);
    }
  }

  const basis =
    normalPaychecks.length > 0 ? normalPaychecks : recentEntries.map(
      (entry) => ({
        entry,
        classification: "normal" as const,
        netPay: Number(entry.net_pay),
      }),
    );

  return {
    predictedNetPay: median(basis.map((paycheck) => paycheck.netPay)),
    normalPaychecks: basis,
    bonusPaychecks,
    lookbackStart,
    lookbackEnd,
  };
}

function valueFromSnapshot(
  snapshot: BankValueSnapshot | null,
  key: SnapshotAccountKey,
) {
  if (!snapshot) return 0;
  const value = Number(snapshot[key]);
  return Number.isFinite(value) ? value : 0;
}

function adjustedAccountValue(
  snapshot: BankValueSnapshot | null,
  pendingTransactions: PendingTransaction[],
  key: SnapshotAccountKey,
) {
  const pendingByAccount = new Map<keyof BankValueSnapshot, number>();
  const settledAccounts = new Set<keyof BankValueSnapshot>();

  for (const transaction of pendingTransactions) {
    if (transaction.is_cleared) continue;
    for (const account of transaction.settled_accounts || []) {
      settledAccounts.add(account);
    }
    pendingByAccount.set(
      transaction.account,
      (pendingByAccount.get(transaction.account) || 0) +
        Number(transaction.amount),
    );
  }

  if (settledAccounts.has(key) && key !== "citi_pending") return 0;

  const posted = valueFromSnapshot(snapshot, key);
  const pending = pendingByAccount.get(key) || 0;
  const isLiability = LIABILITY_ACCOUNTS.includes(key);

  return isLiability ? posted + pending : posted - pending;
}

export function liabilityBreakdownFromSnapshot(
  snapshot: BankValueSnapshot | null,
  pendingTransactions: PendingTransaction[],
) {
  const breakdown = LIABILITY_ACCOUNTS.map((account) => ({
    account,
    label: LIABILITY_LABELS[account],
    amount: adjustedAccountValue(snapshot, pendingTransactions, account),
  })).filter((item) => item.amount > 0);

  return {
    breakdown,
    total: breakdown.reduce((sum, item) => sum + item.amount, 0),
  };
}

function calendarDaysBetween(start: string, end: string) {
  const startValue = Date.parse(`${start}T00:00:00Z`);
  const endValue = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) return 0;
  if (endValue < startValue) return 0;
  return Math.floor((endValue - startValue) / MILLISECONDS_PER_DAY) + 1;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function currentYearBounds(currentDate = new Date()) {
  const year = currentDate.getFullYear();
  return {
    year,
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    today: localDateString(currentDate),
  };
}

export function yearToDateIncome(
  entries: IncomeEntry[],
  currentDate = new Date(),
) {
  const { start, today } = currentYearBounds(currentDate);

  return entries
    .filter((entry) => entry.pay_date >= start && entry.pay_date <= today)
    .reduce((sum, entry) => sum + Number(entry.net_pay), 0);
}

export function projectCurrentYear({
  incomeEntries,
  budgetItems,
  expenseEntries,
  creditCardTransactions,
  currentDate = new Date(),
  nextPaydayOverride,
}: {
  incomeEntries: IncomeEntry[];
  budgetItems: BudgetItem[];
  expenseEntries: ExpenseEntry[];
  creditCardTransactions: CreditCardTransaction[];
  currentDate?: Date;
  nextPaydayOverride?: string | null;
}): CurrentYearProjection {
  const { year, start, end, today } = currentYearBounds(currentDate);
  const paycheckProjection = classifyPaychecks(incomeEntries, currentDate);
  const predictedPaycheck = paycheckProjection.predictedNetPay;
  const remainingPaydays = remainingPaydaysInYear(
    currentDate,
    nextPaydayOverride,
  );
  const ytdIncome = yearToDateIncome(incomeEntries, currentDate);
  const forecastIncome = remainingPaydays * predictedPaycheck;
  const projectedIncome = ytdIncome + forecastIncome;

  const yearDateRange = { start, end: today };
  let ytdExpenses = 0;
  let monthlyExpenseRate = 0;

  for (const item of budgetItems) {
    const averages = budgetItemExpenseAverages(
      item,
      expenseEntries,
      creditCardTransactions,
      yearDateRange,
      today,
      budgetItems,
    );
    ytdExpenses += averages.total;
    monthlyExpenseRate += averages.monthly;
  }

  const remainingDays = Math.max(0, calendarDaysBetween(today, end) - 1);
  const forecastExpenses =
    monthlyExpenseRate * (remainingDays / AVERAGE_DAYS_PER_MONTH);
  const projectedExpenses = ytdExpenses + forecastExpenses;

  return {
    year,
    ytdIncome,
    forecastIncome,
    projectedIncome,
    ytdExpenses,
    forecastExpenses,
    projectedExpenses,
    projectedNet: projectedIncome - projectedExpenses,
    remainingPaydays,
    predictedPaycheck,
    remainingDays,
  };
}

export function projectRevenueAfterPayCycle({
  incomeEntries,
  budgetItems,
  expenseEntries,
  creditCardTransactions,
  snapshot,
  pendingTransactions,
  currentDate = new Date(),
  nextPaydayOverride,
}: {
  incomeEntries: IncomeEntry[];
  budgetItems: BudgetItem[];
  expenseEntries: ExpenseEntry[];
  creditCardTransactions: CreditCardTransaction[];
  snapshot: BankValueSnapshot | null;
  pendingTransactions: PendingTransaction[];
  currentDate?: Date;
  nextPaydayOverride?: string | null;
}): PayCycleProjection {
  const payCycle = getNextPayCycle(currentDate, nextPaydayOverride);
  const paycheckProjection = classifyPaychecks(incomeEntries, currentDate);
  const today = localDateString(currentDate);
  const expenseDateRange = defaultExpenseDateRange(currentDate);
  const dailyAverageExpense = budgetItems.reduce(
    (total, item) =>
      total +
      budgetItemExpenseAverages(
        item,
        expenseEntries,
        creditCardTransactions,
        expenseDateRange,
        today,
        budgetItems,
      ).daily,
    0,
  );
  const predictedSpend = dailyAverageExpense * payCycle.daysRemaining;
  const liabilities = liabilityBreakdownFromSnapshot(
    snapshot,
    pendingTransactions,
  );
  const projectedCashAfterPayCycle =
    paycheckProjection.predictedNetPay - predictedSpend;

  return {
    nextPayday: payCycle.nextPayday,
    nextPaydayLabel: formatPayday(payCycle.nextPayday),
    daysRemaining: payCycle.daysRemaining,
    predictedNextPaycheck: paycheckProjection.predictedNetPay,
    dailyAverageExpense,
    predictedSpend,
    creditCardPayoff: liabilities.total,
    liabilityBreakdown: liabilities.breakdown,
    projectedCashAfterPayCycle,
    paycheckProjection,
  };
}
