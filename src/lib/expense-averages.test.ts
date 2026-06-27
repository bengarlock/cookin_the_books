import { describe, expect, it } from "vitest";

import type { ExpenseEntry } from "./expense-entry-types";
import { expenseEntryAverages } from "./expense-averages";

function entry(amount: string, incurredOn: string): ExpenseEntry {
  return {
    id: Number(`${incurredOn.replaceAll("-", "")}${amount.replace(".", "")}`),
    budget_item: 1,
    incurred_on: incurredOn,
    amount,
    note: "",
    source_identifier: "",
    source_type: "",
    created_at: `${incurredOn}T00:00:00Z`,
    updated_at: `${incurredOn}T00:00:00Z`,
    utility_detail: null,
  };
}

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
