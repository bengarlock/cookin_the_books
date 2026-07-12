import { describe, expect, it } from "vitest";

import type { CreditCardTransaction } from "./credit-card-transaction-types";
import { cashAccountIncomeTransactions } from "./cash-account-ledgers";

function transaction(overrides: Partial<CreditCardTransaction> = {}) {
  return {
    id: 1,
    budget_item: null,
    transaction_type: "credit",
    plaid_category_primary: "INCOME",
    category: "needs_review",
    include: true,
    ...overrides,
  } as CreditCardTransaction;
}

describe("cashAccountIncomeTransactions", () => {
  it("includes genuine checking and savings income", () => {
    expect(cashAccountIncomeTransactions([transaction()])).toHaveLength(1);
  });

  it("excludes account payments, transfers, excluded rows, and card activity", () => {
    expect(cashAccountIncomeTransactions([
      transaction({ category: "account_payment" }),
      transaction({ plaid_category_primary: "TRANSFER_IN" }),
      transaction({ include: false }),
      transaction({ budget_item: 24 }),
    ])).toEqual([]);
  });

  it("can retain excluded income so the UI can include it again", () => {
    const excludedIncome = transaction({ include: false });

    expect(
      cashAccountIncomeTransactions([excludedIncome], {
        includeExcluded: true,
      }),
    ).toEqual([excludedIncome]);
  });
});
