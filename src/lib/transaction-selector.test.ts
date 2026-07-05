import { describe, expect, it } from "vitest";

import type { CreditCardTransaction } from "./credit-card-transaction-types";
import { transactionMatchesCondition } from "./transaction-selector";

const transaction = {
  amount: "100.00",
  transaction_type: "purchase",
} as CreditCardTransaction;

describe("transactionMatchesCondition amount comparisons", () => {
  it("supports greater than or equal to", () => {
    expect(transactionMatchesCondition(transaction, {
      id: "gte",
      field: "amount",
      operator: "greater_than_or_equal",
      value: "100",
    })).toBe(true);
  });

  it("supports less than or equal to", () => {
    expect(transactionMatchesCondition(transaction, {
      id: "lte",
      field: "amount",
      operator: "less_than_or_equal",
      value: "100",
    })).toBe(true);
  });
});
