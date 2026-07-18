import type { CreditCardTransaction } from "./credit-card-transaction-types";
import { pendingCreditCardTransactionAmount } from "./pending-liability-transactions";
import type { PendingTransaction } from "./pending-transaction-types";
import type { BankValueSnapshot, SnapshotAccountKey } from "./snapshot-types";

const DAY = 24 * 60 * 60 * 1000;
const LIABILITY_ACCOUNTS: SnapshotAccountKey[] = [
  "chase_credit", "citi_current", "citi_pending", "barclays_card",
];

function dayNumber(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

function inclusiveDays(start: string, end: string) {
  const startValue = dayNumber(start);
  const endValue = dayNumber(end);
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || endValue < startValue) return 0;
  return Math.floor((endValue - startValue) / DAY) + 1;
}

function snapshotValue(snapshot: BankValueSnapshot | null, key: SnapshotAccountKey) {
  const value = snapshot ? Number(snapshot[key]) : 0;
  return Number.isFinite(value) ? value : 0;
}

function pendingTotals(transactions: PendingTransaction[]) {
  const liabilityTotals = new Map<string, number>();
  const settled = new Set<string>();
  for (const transaction of transactions) {
    if (transaction.is_cleared || transaction.match_status === "matched_pending") continue;
    transaction.settled_accounts.forEach((account) => settled.add(account));
    if (!transaction.settled_accounts.length) {
      liabilityTotals.set(
        transaction.account,
        (liabilityTotals.get(transaction.account) || 0) + Number(transaction.amount),
      );
    }
  }
  return { liabilityTotals, settled };
}

export function calculateFinancialGoalMetrics({
  cap, periodStart, periodEnd, today, projectedPaycheck,
  averageDailyExpenses, snapshot, pendingTransactions, creditCardTransactions,
}: {
  cap: number;
  periodStart: string;
  periodEnd: string;
  today: string;
  projectedPaycheck: number;
  averageDailyExpenses: number;
  snapshot: BankValueSnapshot | null;
  pendingTransactions: PendingTransaction[];
  creditCardTransactions: CreditCardTransaction[];
}) {
  const effectiveToday = today < periodStart ? periodStart : today > periodEnd ? periodEnd : today;
  const totalDays = inclusiveDays(periodStart, periodEnd);
  const elapsedDays = Math.min(totalDays, inclusiveDays(periodStart, effectiveToday));
  const daysLeft = Math.max(0, totalDays - elapsedDays);
  const { liabilityTotals, settled } = pendingTotals(pendingTransactions);
  const adjustedLiability = (key: SnapshotAccountKey) => {
    const posted = settled.has(key) ? 0 : snapshotValue(snapshot, key);
    const pending = liabilityTotals.get(key) || 0;
    return posted + pending;
  };
  const currentLiabilities = LIABILITY_ACCOUNTS.reduce(
    (sum, key) => sum + adjustedLiability(key),
    0,
  );
  const importedPendingLiabilities = creditCardTransactions.reduce(
    (sum, transaction) =>
      sum + pendingCreditCardTransactionAmount(transaction),
    0,
  );
  const spent = currentLiabilities + importedPendingLiabilities;
  const remaining = cap - spent;
  const dailyPace = elapsedDays > 0 ? spent / elapsedDays : 0;
  const projectedSpend = spent + dailyPace * daysLeft;
  const projectedCycleExpenses = averageDailyExpenses * totalDays;

  return {
    spent,
    remaining,
    progress: cap > 0 ? (spent / cap) * 100 : 0,
    daysLeft,
    dailyAllowance: daysLeft > 0 ? Math.max(0, remaining) / daysLeft : 0,
    projectedSpend,
    projectedVariance: cap - projectedSpend,
    projectedPaycheck,
    projectedCycleExpenses,
    projectedSavings: projectedPaycheck - projectedCycleExpenses - cap,
  };
}
