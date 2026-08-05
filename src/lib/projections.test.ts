import { describe, expect, it } from "vitest";

import type { IncomeEntry } from "./income-entry-types";
import type { BankValueSnapshot } from "./snapshot-types";
import type { BudgetItem } from "./budget-item-types";
import type { ExpenseEntry } from "./expense-entry-types";
import type { PendingTransaction } from "./pending-transaction-types";
import type { CreditCardTransaction } from "./credit-card-transaction-types";
import { remainingPaydaysInYear } from "./pay-cycle";
import {
  classifyPaychecks,
  formatRunwayDuration,
  incomeEntriesInLookback,
  liquidReservesFromSnapshot,
  projectCurrentYear,
  projectRevenueAfterPayCycle,
  projectUnemploymentRunway,
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

  it("forecasts the next paycheck from the latest matching pay slot", () => {
    const entries = [
      incomeEntry({
        id: 1,
        pay_date: "2026-01-15",
        net_pay: "2608.83",
        gross_pay: "4016.67",
      }),
      incomeEntry({
        id: 2,
        pay_date: "2026-01-30",
        net_pay: "1448.86",
        gross_pay: "2318.00",
      }),
      incomeEntry({
        id: 3,
        pay_date: "2026-01-30",
        net_pay: "2658.84",
        gross_pay: "4016.67",
      }),
      incomeEntry({
        id: 4,
        pay_date: "2026-04-15",
        net_pay: "2685.01",
        gross_pay: "4154.17",
      }),
      incomeEntry({
        id: 5,
        pay_date: "2026-04-30",
        net_pay: "1500.12",
        gross_pay: "2400.00",
      }),
      incomeEntry({
        id: 6,
        pay_date: "2026-04-30",
        net_pay: "2735.00",
        gross_pay: "4154.17",
      }),
      incomeEntry({
        id: 7,
        pay_date: "2026-06-15",
        net_pay: "2555.19",
        gross_pay: "4154.17",
      }),
      incomeEntry({
        id: 8,
        pay_date: "2026-06-30",
        net_pay: "2605.17",
        gross_pay: "4154.17",
      }),
    ];

    const result = classifyPaychecks(
      entries,
      new Date(2026, 6, 14),
      new Date(2026, 6, 15),
    );

    expect(result.normalPaychecks.map((paycheck) => paycheck.entry.id)).toEqual([
      1, 3, 4, 6, 7, 8,
    ]);
    expect(result.predictedNetPay).toBe(2555.19);
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

function pendingCardPayment(
  overrides: Partial<PendingTransaction> = {},
): PendingTransaction {
  return {
    id: 1,
    account: "chase_checking",
    note: "Credit Card Payment",
    amount: "600.00",
    settled_accounts: ["citi_current"],
    expected_post_date: "2026-07-01",
    is_cleared: false,
    cleared_at: null,
    matched_transaction: null,
    matched_transaction_detail: null,
    match_status: "none",
    match_confidence: null,
    match_method: "",
    matched_at: null,
    created_at: "2026-06-30T09:00:00Z",
    updated_at: "2026-06-30T09:00:00Z",
    ...overrides,
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

  it("includes unmatched synced account income without double counting a paycheck", () => {
    const imported = incomeEntry({
      id: 1,
      pay_date: "2026-06-15",
      net_pay: "3000.00",
      source_type: "income_statement_pdf",
    });
    const synced = (id: number, amount: string, date: string) =>
      ({
        id,
        budget_item: null,
        transaction_type: "credit",
        plaid_category_primary: "INCOME",
        category: "income",
        include: true,
        amount,
        transaction_date: date,
      }) as CreditCardTransaction;

    expect(
      yearToDateIncome(
        [imported],
        new Date(2026, 5, 27),
        [
          synced(10, "3000.00", "2026-06-15"),
          synced(11, "25.00", "2026-06-20"),
        ],
      ),
    ).toBe(3025);
  });
});

describe("remainingPaydaysInYear", () => {
  it("counts paydays after today through year end", () => {
    expect(remainingPaydaysInYear(new Date(2026, 5, 27))).toBe(12);
  });
});

describe("projectCurrentYear", () => {
  it("uses categorized transactions instead of legacy expense tracks when available", () => {
    const result = projectCurrentYear({
      incomeEntries: [],
      budgetItems: [budgetItem()],
      expenseEntries: [expenseEntry("999.00", "2026-06-01")],
      creditCardTransactions: [],
      categorizedTransactions: [
        {
          amount: "120.00",
          category: "groceries",
          include: true,
          split: false,
          transaction_date: "2026-06-01",
          transaction_type: "purchase",
        },
        {
          amount: "80.00",
          category: "needs_review",
          include: true,
          split: false,
          transaction_date: "2026-06-02",
          transaction_type: "purchase",
        },
      ],
      currentDate: new Date(2026, 5, 27),
    });

    expect(result.ytdExpenses).toBe(120);
  });

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
      incomeTransactions: [
        {
          id: 10,
          budget_item: null,
          issuer: "Chase",
          account_last_four: "0277",
          transaction_date: "2026-06-20",
          description: "Interest payment",
          amount: "25.00",
          transaction_type: "credit",
          category: "income",
          include: true,
          plaid_category_primary: "INCOME",
        },
      ],
      currentDate: new Date(2026, 5, 27),
    });

    expect(result.year).toBe(2026);
    expect(result.ytdIncome).toBe(9025);
    expect(result.remainingPaydays).toBe(12);
    expect(result.predictedPaycheck).toBe(3000);
    expect(result.forecastIncome).toBe(36000);
    expect(result.projectedIncome).toBe(45025);
    expect(result.ytdExpenses).toBe(600);
    expect(result.projectedExpenses).toBeGreaterThan(result.ytdExpenses);
    expect(result.projectedNet).toBe(
      result.projectedIncome - result.projectedExpenses,
    );
  });
});

describe("projectRevenueAfterPayCycle", () => {
  it("projects paycheck cash after predicted spend without existing checking", () => {
    const entries = [
      incomeEntry({ id: 1, pay_date: "2026-05-15", net_pay: "3200.00" }),
      incomeEntry({ id: 2, pay_date: "2026-06-01", net_pay: "3180.00" }),
      incomeEntry({ id: 3, pay_date: "2026-06-15", net_pay: "3190.00" }),
    ];
    const item = budgetItem();

    const result = projectRevenueAfterPayCycle({
      incomeEntries: entries,
      budgetItems: [item],
      expenseEntries: [expenseEntry("1780.00", "2026-06-01")],
      creditCardTransactions: [],
      snapshot: snapshot(),
      pendingTransactions: [],
      currentDate: new Date(2026, 5, 27),
    });

    expect(result.predictedNextPaycheck).toBe(3180);
    expect(result.dailyAverageExpense).toBe(10);
    expect(result.spentThisPayCycle).toBe(0);
    expect(result.predictedAdditionalSpend).toBe(40);
    expect(result.predictedSpend).toBe(40);
    expect(result.creditCardPayoff).toBe(1100);
    expect(result.projectedCashAfterPayCycle).toBe(3140);
    expect(result.daysRemaining).toBeGreaterThan(0);
  });

  it("includes spending already incurred in the current pay cycle", () => {
    const result = projectRevenueAfterPayCycle({
      incomeEntries: [
        incomeEntry({ id: 1, pay_date: "2026-06-15", net_pay: "3000.00" }),
      ],
      budgetItems: [budgetItem()],
      expenseEntries: [
        expenseEntry("1780.00", "2026-06-01"),
        expenseEntry("250.00", "2026-06-20"),
      ],
      creditCardTransactions: [],
      snapshot: snapshot(),
      pendingTransactions: [],
      currentDate: new Date(2026, 5, 27),
    });

    expect(result.spentThisPayCycle).toBe(250);
    expect(result.predictedAdditionalSpend).toBe(
      result.dailyAverageExpense * result.daysRemaining,
    );
    expect(result.predictedSpend).toBe(
      result.spentThisPayCycle + result.predictedAdditionalSpend,
    );
    expect(result.projectedCashAfterPayCycle).toBe(
      result.predictedNextPaycheck - result.predictedSpend,
    );
  });

  it("keeps Citi pending charges after the current balance is marked paid", () => {
    const result = projectRevenueAfterPayCycle({
      incomeEntries: [],
      budgetItems: [],
      expenseEntries: [],
      creditCardTransactions: [],
      snapshot: snapshot({
        chase_credit: "0.00",
        citi_current: "600.00",
        citi_pending: "47.99",
        barclays_card: "0.00",
      }),
      pendingTransactions: [pendingCardPayment()],
      currentDate: new Date(2026, 5, 30),
    });

    expect(result.creditCardPayoff).toBe(47.99);
  });

  it("keeps pending liability charges but excludes pending payments from payoff totals", () => {
    const result = projectRevenueAfterPayCycle({
      incomeEntries: [],
      budgetItems: [],
      expenseEntries: [],
      creditCardTransactions: [],
      snapshot: snapshot({
        chase_credit: "400.00",
        citi_current: "0.00",
        citi_pending: "0.00",
        barclays_card: "0.00",
      }),
      pendingTransactions: [
        pendingCardPayment({
          id: 1,
          account: "chase_checking",
          amount: "400.00",
          settled_accounts: ["chase_credit"],
        }),
        pendingCardPayment({
          id: 2,
          account: "chase_credit",
          note: "Pending dinner",
          amount: "35.50",
          settled_accounts: [],
        }),
        pendingCardPayment({
          id: 3,
          account: "chase_credit",
          note: "Pending payment",
          amount: "400.00",
          settled_accounts: ["chase_credit"],
        }),
      ],
      currentDate: new Date(2026, 5, 30),
    });

    expect(result.creditCardPayoff).toBe(35.5);
  });
});

describe("projectUnemploymentRunway", () => {
  it("excludes retirement accounts and divides liquid reserves by daily expenses", () => {
    const item = budgetItem();
    const result = projectUnemploymentRunway({
      budgetItems: [item],
      expenseEntries: [expenseEntry("1780.00", "2026-06-01")],
      creditCardTransactions: [],
      snapshot: snapshot({
        betterment_retirement: "120000.00",
        fidelity_retirement: "450000.00",
      }),
      pendingTransactions: [],
      currentDate: new Date(2026, 5, 27),
    });

    const reserves = liquidReservesFromSnapshot(
      snapshot({
        betterment_retirement: "120000.00",
        fidelity_retirement: "450000.00",
      }),
      [],
    );

    expect(reserves.retirementAssets).toBe(570000);
    expect(reserves.grossLiquidAssets).toBe(32500);
    expect(result.liabilities).toBe(1100);
    expect(result.liquidReserves).toBe(31400);
    expect(result.dailyBurnRate).toBe(10);
    expect(result.runwayDays).toBe(3140);
    expect(result.runwayYears).toBeCloseTo(3140 / 365.2425, 5);
    expect(formatRunwayDuration(result.runwayDays, result.runwayYears)).toBe(
      "8 years, 7 months",
    );
  });

  it("reports depleted runway when liabilities exceed liquid assets", () => {
    const result = projectUnemploymentRunway({
      budgetItems: [budgetItem()],
      expenseEntries: [expenseEntry("100.00", "2026-06-01")],
      creditCardTransactions: [],
      snapshot: snapshot({
        chase_checking: "100.00",
        chase_savings: "0.00",
        chase_credit: "5000.00",
        citi_current: "0.00",
        citi_pending: "0.00",
      }),
      pendingTransactions: [],
      currentDate: new Date(2026, 5, 27),
    });

    expect(result.liquidReserves).toBeLessThan(0);
    expect(result.runwayDays).toBe(0);
    expect(formatRunwayDuration(result.runwayDays, result.runwayYears)).toBe(
      "Depleted",
    );
  });
});
