import {
  importedPendingLiabilityTotals,
  type LoadedAccountTransactions,
} from "./account-transaction-filters";
import type { PendingCardTransaction } from "./credit-card-transaction-types";
import type { PendingTransaction } from "./pending-transaction-types";
import type { BankValueSnapshot, SnapshotAccountKey } from "./snapshot-types";

export const liabilityAccountKeys = new Set<SnapshotAccountKey>([
  "chase_credit",
  "chase_credit_8506",
  "citi_current",
  "citi_pending",
  "barclays_card",
]);

export type TransactionStatusMode = "posted" | "pending" | "both";

function snapshotValue(
  snapshot: BankValueSnapshot | null,
  key: SnapshotAccountKey,
) {
  const value = snapshot ? Number(snapshot[key]) : 0;
  return Number.isFinite(value) ? value : 0;
}

export function calculateAdjustedAccountBalances({
  snapshot,
  pendingTransactions,
  pendingCardTransactions,
  loadedCardTransactions,
}: {
  snapshot: BankValueSnapshot | null;
  pendingTransactions: PendingTransaction[];
  pendingCardTransactions: PendingCardTransaction[];
  loadedCardTransactions?: LoadedAccountTransactions;
}) {
  const pendingByAccount = new Map<SnapshotAccountKey, number>();
  const liabilityPendingByAccount = new Map<SnapshotAccountKey, number>();
  const settledAccounts = new Set<SnapshotAccountKey>();

  for (const transaction of pendingTransactions) {
    if (
      transaction.is_cleared ||
      transaction.match_status === "matched_pending"
    ) {
      continue;
    }
    for (const account of transaction.settled_accounts || []) {
      settledAccounts.add(account);
    }
    pendingByAccount.set(
      transaction.account,
      (pendingByAccount.get(transaction.account) || 0) +
        Number(transaction.amount),
    );
    if (!transaction.settled_accounts.length) {
      liabilityPendingByAccount.set(
        transaction.account,
        (liabilityPendingByAccount.get(transaction.account) || 0) +
          Number(transaction.amount),
      );
    }
  }

  const importedPendingTotals = importedPendingLiabilityTotals({
    summaryTransactions: pendingCardTransactions,
    loadedTransactions: loadedCardTransactions,
  });
  for (const [accountKey, amount] of importedPendingTotals) {
    if (!liabilityAccountKeys.has(accountKey)) continue;
    liabilityPendingByAccount.set(
      accountKey,
      (liabilityPendingByAccount.get(accountKey) || 0) + amount,
    );
  }

  const postedValue = (key: SnapshotAccountKey) =>
    snapshotValue(snapshot, key);

  const pendingValue = (key: SnapshotAccountKey) =>
    (liabilityAccountKeys.has(key)
      ? liabilityPendingByAccount
      : pendingByAccount
    ).get(key) || 0;

  const adjustedValue = (key: SnapshotAccountKey) => {
    const isLiability = liabilityAccountKeys.has(key);
    const posted =
      isLiability && settledAccounts.has(key)
        ? 0
        : postedValue(key);
    const pending = pendingValue(key);
    return isLiability ? posted + pending : posted - pending;
  };

  return {
    adjustedValue,
    liabilityPendingByAccount,
    pendingByAccount,
    pendingValue,
    postedValue,
    settledAccounts,
  };
}
