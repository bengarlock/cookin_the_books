import { describe, expect, it } from "vitest";

import type { ExpenseAutomationCondition } from "./expense-automation-rule-types";
import { normalizeGoalScopeConditions } from "./financial-goal-scope";

const accountCondition: ExpenseAutomationCondition = {
  id: "account",
  field: "account_last_four",
  operator: "equals",
  value: ["4596"],
};
const payPeriodCondition: ExpenseAutomationCondition = {
  id: "period",
  field: "pay_period",
  operator: "equals",
  value: "current",
  include_outstanding_pending: true,
};

describe("normalizeGoalScopeConditions", () => {
  it("preserves pending carryover when selected accounts remain", () => {
    expect(
      normalizeGoalScopeConditions([
        accountCondition,
        payPeriodCondition,
      ])[1].include_outstanding_pending,
    ).toBe(true);
  });

  it("clears pending carryover when selected accounts are removed", () => {
    expect(
      normalizeGoalScopeConditions([payPeriodCondition])[0]
        .include_outstanding_pending,
    ).toBeUndefined();
  });

  it("clears pending carryover when the pay period no longer uses equals", () => {
    expect(
      normalizeGoalScopeConditions([
        accountCondition,
        { ...payPeriodCondition, operator: "not_equals" },
      ])[1].include_outstanding_pending,
    ).toBeUndefined();
  });
});
