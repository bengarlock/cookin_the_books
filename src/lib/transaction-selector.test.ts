import { describe, expect, it } from "vitest";

import type { CreditCardTransaction } from "./credit-card-transaction-types";
import {
  selectTransactions,
  transactionMatchesCondition,
} from "./transaction-selector";

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

describe("selectTransactions row logic", () => {
  it("evaluates each row connector from left to right", () => {
    const matching = {
      ...transaction,
      id: 1,
      description: "Coffee shop",
      issuer: "Chase",
    } as CreditCardTransaction;
    const conditions = [
      {
        id: "description",
        field: "description" as const,
        operator: "contains" as const,
        value: "coffee",
      },
      {
        id: "high-amount",
        field: "amount" as const,
        operator: "greater_than" as const,
        value: "200",
        logic_operator: "and" as const,
      },
      {
        id: "issuer",
        field: "issuer" as const,
        operator: "equals" as const,
        value: "Chase",
        logic_operator: "or" as const,
      },
    ];

    expect(selectTransactions([matching], conditions, "and")).toEqual([
      matching,
    ]);
  });
});
