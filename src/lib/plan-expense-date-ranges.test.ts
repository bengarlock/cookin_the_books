import { describe, expect, it } from "vitest";

import { planExpenseTransactionRanges } from "./plan-expense-date-ranges";

describe("Plan expense transaction ranges", () => {
  it("loads one lookback window for the default year-to-date range", () => {
    expect(
      planExpenseTransactionRanges(
        { start: "2026-01-01", end: "2026-06-22" },
        new Date(2026, 5, 22),
      ),
    ).toEqual([{ start: "2025-07-05", end: "2026-06-22" }]);
  });

  it("keeps separate windows for a historical selection and current Plan data", () => {
    expect(
      planExpenseTransactionRanges(
        { start: "2024-01-01", end: "2024-01-31" },
        new Date(2026, 5, 22),
      ),
    ).toEqual([
      { start: "2023-07-05", end: "2024-01-31" },
      { start: "2025-07-05", end: "2026-06-22" },
    ]);
  });

  it("merges overlapping selected and current analysis windows", () => {
    expect(
      planExpenseTransactionRanges(
        { start: "2025-12-01", end: "2025-12-31" },
        new Date(2026, 5, 22),
      ),
    ).toEqual([{ start: "2025-06-04", end: "2026-06-22" }]);
  });
});
