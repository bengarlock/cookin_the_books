import { describe, expect, it } from "vitest";

import type {
  CreditCardTransaction,
  ExpenseTransaction,
} from "./credit-card-transaction-types";
import {
  compactExpenseTransaction,
  mergeExpenseTransactions,
} from "./expense-transaction-record";

function fullTransaction(
  overrides: Partial<CreditCardTransaction> = {},
): CreditCardTransaction {
  return {
    id: 1,
    budget_item: 2,
    issuer: "Chase",
    account_last_four: "9125",
    statement_start: "2026-01-01",
    statement_end: "2026-01-31",
    transaction_date: "2026-01-15",
    posting_date: "2026-01-16",
    description: "Coffee",
    amount: "16.99",
    transaction_type: "purchase",
    source_identifier: "test",
    category: "dining",
    category_confidence: null,
    category_source: "",
    categorized_at: null,
    tags: [],
    split: false,
    include: true,
    note: "",
    plaid_category_primary: "",
    plaid_category_detailed: "",
    plaid_category_confidence: "",
    plaid_category_icon_url: "",
    plaid_legacy_categories: [],
    plaid_legacy_category_id: "",
    plaid_payment_channel: "",
    plaid_transaction_type: "",
    plaid_counterparty_name: "",
    plaid_counterparty_type: "",
    plaid_counterparty_entity_id: "",
    pending: false,
    manual_match: null,
    related_transactions: [],
    amazon_orders: [],
    receipt_orders: [],
    created_at: "2026-01-15T12:00:00Z",
    ...overrides,
  };
}

function compactTransaction(
  overrides: Partial<ExpenseTransaction> = {},
): ExpenseTransaction {
  return {
    ...compactExpenseTransaction(fullTransaction()),
    ...overrides,
  };
}

describe("compactExpenseTransaction", () => {
  it("keeps only the expense fields and derives matched-order flags", () => {
    const compact = compactExpenseTransaction(
      fullTransaction({
        amazon_orders: [
          {
            id: 10,
            order_id: "A-10",
            website: "Amazon.com",
            order_date: null,
            ship_date: null,
            status: "",
            payment_method: "",
            total_amount: "16.99",
            match_difference: null,
            match_method: "exact",
            items: [],
          },
        ],
      }),
    );

    expect(compact.has_amazon_orders).toBe(true);
    expect(compact.has_receipt_orders).toBe(false);
    expect(compact).not.toHaveProperty("source_identifier");
  });
});

describe("mergeExpenseTransactions", () => {
  it("updates compact fields without discarding lazy-loaded order details", () => {
    const current = compactTransaction({
      note: "Old",
      amazon_orders: [
        {
          id: 10,
          order_id: "A-10",
          website: "Amazon.com",
          order_date: null,
          ship_date: null,
          status: "",
          payment_method: "",
          total_amount: "16.99",
          match_difference: null,
          match_method: "exact",
          items: [],
        },
      ],
    });
    const incoming = compactTransaction({
      note: "Updated",
      amazon_orders: undefined,
      receipt_orders: undefined,
    });

    const [merged] = mergeExpenseTransactions([current], [incoming]);

    expect(merged.note).toBe("Updated");
    expect(merged.amazon_orders).toEqual(current.amazon_orders);
  });
});
