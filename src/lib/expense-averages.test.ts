import { describe, expect, it } from "vitest";

import type { BudgetItem } from "./budget-item-types";
import type { ExpenseEntry } from "./expense-entry-types";
import {
  budgetItemExpenseAverages,
  creditCardExclusionTotal,
  expenseEntryAverages,
} from "./expense-averages";

function entry(amount: string, incurredOn: string): ExpenseEntry {
  return {
    id: Number(`${incurredOn.replaceAll("-", "")}${amount.replace(".", "")}`),
    budget_item: 1,
    incurred_on: incurredOn,
    amount,
    note: "",
    exclude_from_credit_card: false,
    source_identifier: "",
    source_type: "",
    created_at: `${incurredOn}T00:00:00Z`,
    updated_at: `${incurredOn}T00:00:00Z`,
    utility_detail: null,
  };
}

function budgetItem(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id: 1,
    key: "utilities",
    label: "Utilities",
    monthly_amount: "0.000000",
    is_shared_cost: false,
    sort_order: 0,
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("creditCardExclusionTotal", () => {
  it("sums excluded expense entries in range using shared-cost rules", () => {
    const total = creditCardExclusionTotal(
      [
        { ...entry("100.00", "2026-06-01"), exclude_from_credit_card: true },
        { ...entry("50.00", "2026-06-05"), exclude_from_credit_card: false },
        { ...entry("80.00", "2026-06-08"), exclude_from_credit_card: true },
      ],
      new Map([[budgetItem().id, budgetItem()]]),
      { start: "2026-06-01", end: "2026-06-10" },
      "2026-06-10",
    );

    expect(total).toBe(180);
  });
});

describe("budgetItemExpenseAverages", () => {
  it("deducts excluded expenses from the credit card budget item totals", () => {
    const creditCardItem = budgetItem({
      id: 9,
      key: "credit-card",
      label: "Credit Card",
    });
    const housingItem = budgetItem({ id: 2, key: "housing", label: "Housing" });
    const averages = budgetItemExpenseAverages(
      creditCardItem,
      [
        {
          ...entry("100.00", "2026-06-05"),
          budget_item: housingItem.id,
          exclude_from_credit_card: true,
        },
      ],
      [
        {
          budget_item: creditCardItem.id,
          statement_start: "2026-06-01",
          statement_end: "2026-06-30",
          transaction_date: "2026-06-05",
          amount: "500.00",
          transaction_type: "purchase",
          include: true,
          split: false,
        },
      ],
      { start: "2026-06-01", end: "2026-06-10" },
      "2026-06-10",
      [creditCardItem, housingItem],
    );

    expect(averages.total).toBe(400);
  });

  it("uses expense entry averages for non-credit-card budget items", () => {
    const averages = budgetItemExpenseAverages(
      budgetItem(),
      [entry("100.00", "2026-06-01"), entry("50.00", "2026-06-05")],
      [],
      { start: "2026-06-01", end: "2026-06-10" },
      "2026-06-10",
    );

    expect(averages.total).toBe(150);
    expect(averages.monthly).toBeCloseTo(456.55, 2);
  });
});

describe("expenseEntryAverages", () => {
  it("computes daily, weekly, and monthly averages over elapsed range days", () => {
    const averages = expenseEntryAverages(
      [entry("100.00", "2026-06-01"), entry("50.00", "2026-06-05")],
      "2026-06-01",
      "2026-06-10",
      "2026-06-10",
    );

    expect(averages.total).toBe(150);
    expect(averages.daily).toBe(15);
    expect(averages.weekly).toBe(105);
    expect(averages.monthly).toBeCloseTo(456.55, 2);
  });

  it("halves shared expense totals when the expense is marked shared", () => {
    const averages = expenseEntryAverages(
      [entry("100.00", "2026-06-01"), entry("50.00", "2026-06-05")],
      "2026-06-01",
      "2026-06-10",
      "2026-06-10",
      true,
    );

    expect(averages.total).toBe(75);
    expect(averages.daily).toBe(7.5);
  });

  it("excludes future entries when the selected range extends past today", () => {
    const averages = expenseEntryAverages(
      [entry("100.00", "2026-06-01"), entry("200.00", "2026-06-20")],
      "2026-06-01",
      "2026-06-30",
      "2026-06-10",
    );

    expect(averages.total).toBe(100);
    expect(averages.daily).toBe(10);
  });
});
