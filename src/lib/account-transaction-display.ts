import type { CreditCardTransaction } from "./credit-card-transaction-types";
import type { BankValueSnapshot, SnapshotAccountKey } from "./snapshot-types";

const cashAccounts = new Set<SnapshotAccountKey>([
  "chase_checking",
  "chase_savings",
]);

const liabilityAccounts = new Set<SnapshotAccountKey>([
  "chase_credit",
  "citi_current",
  "citi_pending",
  "barclays_card",
]);

export function accountTransactionDisplayAmount(
  transaction: CreditCardTransaction,
  accountKey: keyof BankValueSnapshot,
) {
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount)) return null;
  const snapshotAccountKey = accountKey as SnapshotAccountKey;

  if (cashAccounts.has(snapshotAccountKey)) {
    return transaction.transaction_type === "credit" ? amount : -amount;
  }

  if (liabilityAccounts.has(snapshotAccountKey)) {
    return transaction.transaction_type === "payment" ||
      transaction.transaction_type === "credit"
      ? -amount
      : amount;
  }

  return amount;
}
