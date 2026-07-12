import type { CreditCardTransaction } from "./credit-card-transaction-types";
import type { IncomeEntry } from "./income-entry-types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MATCH_WINDOW_DAYS = 3;

function cents(value: string) {
  return Math.round(Number(value) * 100);
}

function dayDifference(left: string, right: string) {
  const leftDate = Date.parse(`${left}T12:00:00Z`);
  const rightDate = Date.parse(`${right}T12:00:00Z`);
  return Math.abs(leftDate - rightDate) / DAY_IN_MS;
}

export type SyncedIncomeMatch = {
  incomeEntry: IncomeEntry;
  transaction: CreditCardTransaction;
};

export function reconcileSyncedIncome(
  incomeEntries: IncomeEntry[],
  syncedTransactions: CreditCardTransaction[],
) {
  const availableEntries = incomeEntries.filter(
    (entry) =>
      entry.source_type === "income_statement_pdf" && cents(entry.net_pay) > 0,
  );
  const matchedEntryIds = new Set<number>();
  const matches: SyncedIncomeMatch[] = [];
  const unmatchedTransactions: CreditCardTransaction[] = [];

  for (const transaction of syncedTransactions) {
    const candidate = availableEntries
      .filter(
        (entry) =>
          !matchedEntryIds.has(entry.id) &&
          cents(entry.net_pay) === cents(transaction.amount) &&
          dayDifference(entry.pay_date, transaction.transaction_date) <=
            MATCH_WINDOW_DAYS,
      )
      .sort(
        (left, right) =>
          dayDifference(left.pay_date, transaction.transaction_date) -
            dayDifference(right.pay_date, transaction.transaction_date) ||
          right.id - left.id,
      )[0];

    if (!candidate) {
      unmatchedTransactions.push(transaction);
      continue;
    }

    matchedEntryIds.add(candidate.id);
    matches.push({ incomeEntry: candidate, transaction });
  }

  return { matches, unmatchedTransactions };
}
