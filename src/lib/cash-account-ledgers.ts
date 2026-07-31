import type { IncomeTransaction } from "./credit-card-transaction-types";

export function cashAccountIncomeTransactions(
  transactions: IncomeTransaction[],
  { includeExcluded = false }: { includeExcluded?: boolean } = {},
) {
  return transactions.filter(
    (transaction) =>
      transaction.budget_item === null &&
      transaction.transaction_type === "credit" &&
      transaction.plaid_category_primary === "INCOME" &&
      transaction.category !== "account_payment" &&
      (includeExcluded || transaction.include !== false),
  );
}
