import type { CreditCardTransaction } from "./credit-card-transaction-types";

export function cashAccountIncomeTransactions(
  transactions: CreditCardTransaction[],
) {
  return transactions.filter(
    (transaction) =>
      transaction.budget_item === null &&
      transaction.transaction_type === "credit" &&
      transaction.plaid_category_primary === "INCOME" &&
      transaction.category !== "account_payment" &&
      transaction.include !== false,
  );
}
