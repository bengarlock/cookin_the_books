import type { IncomeTransaction } from "./credit-card-transaction-types";
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
  transaction: IncomeTransaction;
};

export function reconcileSyncedIncome(
  incomeEntries: IncomeEntry[],
  syncedTransactions: IncomeTransaction[],
) {
  const availableEntries = incomeEntries.filter(
    (entry) =>
      entry.source_type === "income_statement_pdf" && cents(entry.net_pay) > 0,
  );
  const matchedEntryIds = new Set<number>();
  const matches: SyncedIncomeMatch[] = [];
  const unmatchedTransactions: IncomeTransaction[] = [];

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

export function incomeLedgerTotals(
  incomeEntries: IncomeEntry[],
  syncedTransactions: IncomeTransaction[],
  dateRange?: { start: string; end: string },
) {
  const { unmatchedTransactions } = reconcileSyncedIncome(
    incomeEntries,
    syncedTransactions,
  );
  const entriesInRange = dateRange
    ? incomeEntries.filter(
        (entry) =>
          entry.pay_date >= dateRange.start && entry.pay_date <= dateRange.end,
      )
    : incomeEntries;
  const syncedInRange = unmatchedTransactions.filter(
    (transaction) =>
      transaction.include !== false &&
      (!dateRange ||
        (transaction.transaction_date >= dateRange.start &&
          transaction.transaction_date <= dateRange.end)),
  );
  const syncedTotal = syncedInRange.reduce(
    (total, transaction) => total + Number(transaction.amount),
    0,
  );

  return {
    gross:
      entriesInRange.reduce(
        (total, entry) => total + Number(entry.gross_pay),
        0,
      ) + syncedTotal,
    net:
      entriesInRange.reduce(
        (total, entry) => total + Number(entry.net_pay),
        0,
      ) + syncedTotal,
    syncedInRange,
    syncedTotal,
  };
}
