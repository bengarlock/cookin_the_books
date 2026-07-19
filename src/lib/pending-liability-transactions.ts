import type { PendingCardTransaction } from "@/lib/credit-card-transaction-types";

const accountPaymentDetailedCategories = new Set([
  "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
  "TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS",
  "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS",
  "TRANSFER_OUT_SAVINGS",
]);

const accountTransferDetailedCategories = new Set([
  "TRANSFER_IN_ACCOUNT_TRANSFER",
  "TRANSFER_OUT_ACCOUNT_TRANSFER",
]);

const accountTransferDescriptionPatterns = [
  /\baccount transfer\b/,
  /\bbank transfer\b/,
  /\bonline transfer\b/,
  /\btransfer (?:from|to) (?:chk|sav|checking|savings)\b/,
];

export function isPendingCreditCardPayment(transaction: PendingCardTransaction) {
  if (transaction.transaction_type === "payment") return true;
  if (transaction.category === "account_payment") return true;
  if (accountPaymentDetailedCategories.has(transaction.plaid_category_detailed)) {
    return true;
  }
  if (!accountTransferDetailedCategories.has(transaction.plaid_category_detailed)) {
    return false;
  }
  const description = transaction.description.toLowerCase().replace(/\s+/g, " ");
  return accountTransferDescriptionPatterns.some((pattern) =>
    pattern.test(description),
  );
}

export function pendingCreditCardTransactionAmount(
  transaction: PendingCardTransaction,
) {
  if (transaction.pending === false || isPendingCreditCardPayment(transaction)) {
    return 0;
  }
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount)) return 0;
  return transaction.transaction_type === "credit" ? -amount : amount;
}
