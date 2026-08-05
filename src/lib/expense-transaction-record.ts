import type {
  CreditCardTransaction,
  ExpenseTransaction,
} from "@/lib/credit-card-transaction-types";

export function compactExpenseTransaction(
  transaction: CreditCardTransaction | ExpenseTransaction,
): ExpenseTransaction {
  return {
    id: transaction.id,
    budget_item: transaction.budget_item,
    issuer: transaction.issuer,
    account_last_four: transaction.account_last_four,
    statement_start: transaction.statement_start,
    statement_end: transaction.statement_end,
    transaction_date: transaction.transaction_date,
    posting_date: transaction.posting_date,
    description: transaction.description,
    amount: transaction.amount,
    transaction_type: transaction.transaction_type,
    category: transaction.category,
    category_source: transaction.category_source,
    tags: transaction.tags,
    split: transaction.split,
    include: transaction.include,
    pending: transaction.pending,
    note: transaction.note,
    plaid_category_primary: transaction.plaid_category_primary,
    plaid_category_detailed: transaction.plaid_category_detailed,
    plaid_counterparty_name: transaction.plaid_counterparty_name,
    plaid_counterparty_entity_id: transaction.plaid_counterparty_entity_id,
    related_transaction_ids:
      "related_transaction_ids" in transaction
        ? transaction.related_transaction_ids
        : transaction.related_transactions.map((related) => related.id),
    has_amazon_orders:
      "has_amazon_orders" in transaction
        ? transaction.has_amazon_orders
        : Boolean(transaction.amazon_orders?.length),
    has_receipt_orders:
      "has_receipt_orders" in transaction
        ? transaction.has_receipt_orders
        : Boolean(transaction.receipt_orders?.length),
    amazon_orders: transaction.amazon_orders,
    receipt_orders: transaction.receipt_orders,
  };
}

export function mergeExpenseTransactions(
  current: ExpenseTransaction[],
  incoming: ExpenseTransaction[],
) {
  const byId = new Map(current.map((transaction) => [transaction.id, transaction]));
  for (const transaction of incoming) {
    const previous = byId.get(transaction.id);
    byId.set(
      transaction.id,
      previous
        ? {
            ...previous,
            ...transaction,
            amazon_orders:
              transaction.amazon_orders ?? previous.amazon_orders,
            receipt_orders:
              transaction.receipt_orders ?? previous.receipt_orders,
          }
        : transaction,
    );
  }
  return Array.from(byId.values());
}
