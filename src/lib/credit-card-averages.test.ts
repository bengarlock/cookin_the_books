import { describe, expect, it } from "vitest";

import type { CreditCardTransaction } from "./credit-card-transaction-types";
import { creditCardExpenditureAverages } from "./credit-card-averages";

function transaction(
  overrides: Partial<CreditCardTransaction>,
): CreditCardTransaction {
  return {
    id: 1,
    budget_item: 1,
    issuer: "Chase",
    account_last_four: "9125",
    statement_start: "2026-06-01",
    statement_end: "2026-06-30",
    transaction_date: "2026-06-10",
    posting_date: null,
    description: "Purchase",
    amount: "300.00",
    transaction_type: "purchase",
    source_identifier: "test",
    created_at: "2026-06-30T00:00:00Z",
    ...overrides,
  };
}

describe("credit-card expenditure averages", () => {
  it("uses statement coverage and excludes payments and credits", () => {
    const result = creditCardExpenditureAverages(
      [
        transaction({ amount: "300.00" }),
        transaction({
          id: 2,
          amount: "-300.00",
          transaction_type: "payment",
        }),
      ],
      "2025-07-01",
      "2026-06-30",
    );

    expect(result.total).toBe(300);
    expect(result.daily).toBe(10);
    expect(result.weekly).toBe(70);
    expect(result.monthly).toBeCloseTo(304.36875);
  });

  it("does not double-count overlapping statement coverage", () => {
    const result = creditCardExpenditureAverages(
      [
        transaction({ amount: "150.00" }),
        transaction({
          id: 2,
          issuer: "Citi",
          amount: "150.00",
        }),
      ],
      "2025-07-01",
      "2026-06-30",
    );

    expect(result.daily).toBe(10);
  });

  it("returns zero averages when no expenditures exist", () => {
    expect(
      creditCardExpenditureAverages([], "2025-07-01", "2026-06-30"),
    ).toEqual({ total: 0, daily: 0, weekly: 0, monthly: 0 });
  });
});
