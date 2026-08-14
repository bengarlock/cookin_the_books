import { describe, expect, it } from "vitest";

import type { CreditCardTransaction } from "./credit-card-transaction-types";
import {
  isPendingCreditCardPayment,
  pendingCreditCardTransactionAmount,
} from "./pending-liability-transactions";

function transaction(
  overrides: Partial<CreditCardTransaction> = {},
): CreditCardTransaction {
  return {
    id: 1,
    budget_item: null,
    issuer: "Citibank Online",
    account_last_four: "4596",
    statement_start: "2026-07-01",
    statement_end: "2026-07-31",
    transaction_date: "2026-07-14",
    posting_date: null,
    description: "ShopRite",
    amount: "38.94",
    transaction_type: "purchase",
    source_identifier: "",
    category: "groceries",
    category_confidence: null,
    category_source: "plaid",
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
    pending: true,
    manual_match: null,
    related_transactions: [],
    created_at: "2026-07-14T00:00:00Z",
    ...overrides,
  };
}

describe("pendingCreditCardTransactionAmount", () => {
  it("includes pending purchases and subtracts pending credits", () => {
    expect(pendingCreditCardTransactionAmount(transaction())).toBe(38.94);
    expect(
      pendingCreditCardTransactionAmount(transaction({ pending: false })),
    ).toBe(0);
    expect(
      pendingCreditCardTransactionAmount(
        transaction({ amount: "12.34", transaction_type: "credit" }),
      ),
    ).toBe(-12.34);
  });

  it("excludes pending card payments by type, category, and Plaid metadata", () => {
    expect(
      isPendingCreditCardPayment(
        transaction({ transaction_type: "payment", category: "needs_review" }),
      ),
    ).toBe(true);
    expect(
      pendingCreditCardTransactionAmount(
        transaction({
          amount: "100.00",
          category: "account_payment",
          transaction_type: "purchase",
        }),
      ),
    ).toBe(0);
    expect(
      pendingCreditCardTransactionAmount(
        transaction({
          amount: "100.00",
          category: "needs_review",
          plaid_category_detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
          transaction_type: "purchase",
        }),
      ),
    ).toBe(0);
    expect(
      pendingCreditCardTransactionAmount(
        transaction({
          amount: "100.00",
          category: "needs_review",
          description: "Online transfer from checking",
          plaid_category_detailed: "TRANSFER_IN_ACCOUNT_TRANSFER",
          transaction_type: "purchase",
        }),
      ),
    ).toBe(0);
    expect(
      pendingCreditCardTransactionAmount(
        transaction({
          amount: "1135.82",
          category: "",
          description: "PAYMENT THANK YOU",
          plaid_category_detailed: "TRANSFER_IN_OTHER_TRANSFER_IN",
          transaction_type: "credit",
        }),
      ),
    ).toBe(0);
  });
});
