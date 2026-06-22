import { describe, expect, it } from "vitest";

import {
  amountForBudgetPeriod,
  budgetPeriods,
  monthlyAmountFromBudgetPeriod,
} from "./budget-periods";

describe("budget period conversions", () => {
  it("derives every period from a monthly amount", () => {
    expect(amountForBudgetPeriod(400, "weekly")).toBe(100);
    expect(amountForBudgetPeriod(400, "biweekly")).toBe(200);
    expect(amountForBudgetPeriod(400, "monthly")).toBe(400);
    expect(amountForBudgetPeriod(400, "yearly")).toBe(4800);
  });

  it.each(budgetPeriods)("round-trips %s edits through monthly", (period) => {
    const originalMonthlyAmount = 460.556667;
    const editedValue = amountForBudgetPeriod(originalMonthlyAmount, period);

    expect(monthlyAmountFromBudgetPeriod(editedValue, period)).toBeCloseTo(
      originalMonthlyAmount,
      6,
    );
  });
});
