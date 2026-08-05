import { describe, expect, it } from "vitest";

import {
  categorizedExpenseAverages,
  categorizedExpenseCategories,
} from "./categorized-expense-averages";

const range = { start: "2026-01-01", end: "2026-01-31" };

describe("categorized expense averages", () => {
  const transactions = [
    { amount: "100", category: "groceries", include: true, split: false, transaction_date: "2026-01-02", transaction_type: "purchase" as const },
    { amount: "40", category: "groceries", include: true, split: true, transaction_date: "2026-01-03", transaction_type: "purchase" as const },
    { amount: "50", category: "needs_review", include: true, split: false, transaction_date: "2026-01-04", transaction_type: "purchase" as const },
    { amount: "70", category: "account_payment", include: true, split: false, transaction_date: "2026-01-05", transaction_type: "payment" as const },
    { amount: "80", category: "dining", include: false, split: false, transaction_date: "2026-01-06", transaction_type: "purchase" as const },
    { amount: "35", category: "dining", include: true, pending: true, split: false, transaction_date: "2026-01-07", transaction_type: "purchase" as const },
  ];

  it("uses only included, categorized expense transactions", () => {
    const averages = categorizedExpenseAverages(transactions, range, "2026-01-31");
    expect(averages.total).toBe(120);
    expect(averages.daily).toBeCloseTo(120 / 31);
  });

  it("groups eligible spending by category", () => {
    expect(categorizedExpenseCategories(transactions, range, "2026-01-31")).toEqual(["groceries"]);
    expect(categorizedExpenseAverages(transactions, range, "2026-01-31", "groceries").total).toBe(120);
  });

  it("excludes pending transactions while retaining imported property taxes", () => {
    const supplementalExpenses = [
      { amount: "300", category: "property_taxes", incurred_on: "2026-01-08" },
    ];

    expect(
      categorizedExpenseAverages(
        transactions,
        range,
        "2026-01-31",
        undefined,
        supplementalExpenses,
      ).total,
    ).toBe(420);
    expect(
      categorizedExpenseCategories(
        transactions,
        range,
        "2026-01-31",
        supplementalExpenses,
      ),
    ).toEqual(["groceries", "property_taxes"]);
  });
});
