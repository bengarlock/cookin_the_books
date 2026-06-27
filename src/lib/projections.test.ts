import { describe, expect, it } from "vitest";

import type { IncomeEntry } from "./income-entry-types";
import type { BankValueSnapshot } from "./snapshot-types";
import type { BudgetItem } from "./budget-item-types";
import type { ExpenseEntry } from "./expense-entry-types";
import { remainingPaydaysInYear } from "./pay-cycle";
import {
  classifyPaychecks,
  incomeEntriesInLookback,
  projectCurrentYear,
  projectRevenueAfterPayCycle,
  yearToDateIncome,
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

function expenseEntry(
  amount: string,
  incurredOn: string,
  budgetItemId = 1,
): ExpenseEntry {
  return {
    id: Number(`${incurredOn.replaceAll("-", "")}${amount.replace(".", "")}`),
    budget_item: budgetItemId,
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

describe("yearToDateIncome", () => {
  it("sums net pay for the current calendar year through today", () => {
    const total = yearToDateIncome(
      [
        incomeEntry({ id: 1, pay_date: "2026-01-15", net_pay: "3000.00" }),
        incomeEntry({ id: 2, pay_date: "2026-06-01", net_pay: "3100.00" }),
        incomeEntry({ id: 3, pay_date: "2025-12-15", net_pay: "2900.00" }),
        incomeEntry({ id: 4, pay_date: "2026-12-15", net_pay: "5000.00" }),
      ],
      new Date(2026, 5, 27),
    );

    expect(total).toBe(6100);
  });
});

describe("remainingPaydaysInYear", () => {
  it("counts paydays after today through year end", () => {
    expect(remainingPaydaysInYear(new Date(2026, 5, 27))).toBe(12);
  });
});

describe("projectCurrentYear", () => {
  it("combines year-to-date totals with forecasts for the rest of the year", () => {
    const item = budgetItem();
    const result = projectCurrentYear({
      incomeEntries: [
        incomeEntry({ id: 1, pay_date: "2026-01-15", net_pay: "3000.00" }),
        incomeEntry({ id: 2, pay_date: "2026-06-01", net_pay: "3000.00" }),
        incomeEntry({ id: 3, pay_date: "2026-06-15", net_pay: "3000.00" }),
      ],
      budgetItems: [item],
      expenseEntries: [expenseEntry("600.00", "2026-06-01")],
      creditCardTransactions: [],
      currentDate: new Date(2026, 5, 27),
    });

    expect(result.year).toBe(2026);
    expect(result.ytdIncome).toBe(9000);
    expect(result.remainingPaydays).toBe(12);
    expect(result.predictedPaycheck).toBe(3000);
    expect(result.forecastIncome).toBe(36000);
    expect(result.projectedIncome).toBe(45000);
    expect(result.ytdExpenses).toBe(600);
    expect(result.projectedExpenses).toBeGreaterThan(result.ytdExpenses);
    expect(result.projectedNet).toBe(
      result.projectedIncome - result.projectedExpenses,
    );
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
