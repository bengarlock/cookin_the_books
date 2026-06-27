import { describe, expect, it } from "vitest";

import type { IncomeEntry } from "./income-entry-types";
import type { BankValueSnapshot } from "./snapshot-types";
import {
  classifyPaychecks,
  incomeEntriesInLookback,
  projectRevenueAfterPayCycle,
} from "./projections";

function incomeEntry(
  overrides: Partial<IncomeEntry> & Pick<IncomeEntry, "pay_date" | "net_pay">,
): IncomeEntry {
  return {
    id: 1,
    employer: "Demandbase",
    employee_name: "Test User",
    period_start: overrides.pay_date,
    period_end: overrides.pay_date,
    gross_pay: overrides.net_pay,
    federal_taxable_wages: null,
    advice_number: "1",
    source_type: "manual",
    source_identifier: "manual",
    statement_pdf_url: "",
    breakdown: {},
    created_at: overrides.pay_date,
    updated_at: overrides.pay_date,
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<BankValueSnapshot> = {},
): BankValueSnapshot {
  return {
    id: 1,
    chase_checking: "2500.00",
    chase_savings: "30000.00",
    chase_credit: "400.00",
    citi_current: "600.00",
    citi_pending: "100.00",
    barclays_card: "0.00",
    etrade: "0.00",
    betterment_general: "0.00",
    betterment_safety: "0.00",
    betterment_retirement: "0.00",
    fidelity_retirement: "0.00",
    source_updated_at: "2026-06-27T12:00:00Z",
    snapshot_date: "2026-06-27",
    net_assets: "0.00",
    change: "0.00",
    change_percentage: "0.00",
    is_highpoint: false,
    last_highpoint_snapshot_id: 0,
    last_highpoint_date: "",
    last_highpoint_net_assets: "0.00",
    loss_since_highpoint: "0.00",
    loss_since_highpoint_percentage: "0.00",
    notes: "",
    metadata: {},
    is_editable: false,
    created_at: "2026-06-27T12:00:00Z",
    updated_at: "2026-06-27T12:00:00Z",
    ...overrides,
  };
}

describe("incomeEntriesInLookback", () => {
  it("keeps only pay statements from the past year", () => {
    const entries = [
      incomeEntry({ id: 1, pay_date: "2026-01-15", net_pay: "3000.00" }),
      incomeEntry({ id: 2, pay_date: "2025-08-01", net_pay: "3000.00" }),
      incomeEntry({ id: 3, pay_date: "2024-05-01", net_pay: "3000.00" }),
    ];

    const result = incomeEntriesInLookback(
      entries,
      new Date(2026, 5, 27),
    );

    expect(result.map((entry) => entry.id)).toEqual([2, 1]);
  });
});

describe("classifyPaychecks", () => {
  it("treats high outlier paychecks as bonuses", () => {
    const entries = [
      incomeEntry({ id: 1, pay_date: "2026-01-15", net_pay: "3200.00" }),
      incomeEntry({ id: 2, pay_date: "2026-02-01", net_pay: "3180.00" }),
      incomeEntry({ id: 3, pay_date: "2026-02-15", net_pay: "3190.00" }),
      incomeEntry({ id: 4, pay_date: "2026-03-01", net_pay: "3210.00" }),
      incomeEntry({ id: 5, pay_date: "2026-03-15", net_pay: "3175.00" }),
      incomeEntry({ id: 6, pay_date: "2026-04-01", net_pay: "6400.00" }),
    ];

    const result = classifyPaychecks(entries, new Date(2026, 5, 27));

    expect(result.bonusPaychecks.map((paycheck) => paycheck.entry.id)).toEqual([
      6,
    ]);
    expect(result.normalPaychecks).toHaveLength(5);
    expect(result.predictedNetPay).toBe(3190);
  });
});

describe("projectRevenueAfterPayCycle", () => {
  it("projects checking cash after the next paycheck and card payoff", () => {
    const entries = [
      incomeEntry({ id: 1, pay_date: "2026-05-15", net_pay: "3200.00" }),
      incomeEntry({ id: 2, pay_date: "2026-06-01", net_pay: "3180.00" }),
      incomeEntry({ id: 3, pay_date: "2026-06-15", net_pay: "3190.00" }),
    ];

    const result = projectRevenueAfterPayCycle({
      incomeEntries: entries,
      snapshot: snapshot(),
      pendingTransactions: [],
      currentDate: new Date(2026, 5, 27),
    });

    expect(result.predictedNextPaycheck).toBe(3190);
    expect(result.currentChecking).toBe(2500);
    expect(result.creditCardPayoff).toBe(1100);
    expect(result.projectedCashAfterPayCycle).toBe(4590);
    expect(result.daysRemaining).toBeGreaterThan(0);
  });
});
