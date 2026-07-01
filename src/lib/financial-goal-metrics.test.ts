import { describe, expect, it } from "vitest";

import { calculateFinancialGoalMetrics } from "./financial-goal-metrics";
import type { BankValueSnapshot } from "./snapshot-types";

const snapshot = {
  chase_checking: "2500.00", chase_savings: "500.00",
  chase_credit: "100.00", citi_current: "150.00", citi_pending: "25.00",
  barclays_card: "25.00", net_assets: "10000.00",
} as BankValueSnapshot;

describe("calculateFinancialGoalMetrics", () => {
  it("calculates cap progress, pace, and remaining daily allowance", () => {
    const metrics = calculateFinancialGoalMetrics({
      cap: 1000,
      periodStart: "2026-07-01",
      periodEnd: "2026-07-10",
      today: "2026-07-05",
      projectedPaycheck: 2000,
      averageDailyExpenses: 50,
      snapshot,
      pendingTransactions: [],
    });

    expect(metrics.spent).toBe(300);
    expect(metrics.progress).toBe(30);
    expect(metrics.daysLeft).toBe(5);
    expect(metrics.dailyAllowance).toBe(140);
    expect(metrics.projectedSpend).toBe(600);
    expect(metrics.projectedVariance).toBe(400);
    expect(metrics.projectedCycleExpenses).toBe(500);
    expect(metrics.projectedSavings).toBe(500);
  });
});
