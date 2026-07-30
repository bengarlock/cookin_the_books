import { describe, expect, it } from "vitest";

import type { TransactionSelectorRecord } from "./credit-card-transaction-types";
import { evaluateFinancialGoal, normalizeFinancialGoal } from "./financial-goal-evaluation";
import type { FinancialGoal, FinancialGoalInput } from "./financial-goal-types";
import type { BankValueSnapshot } from "./snapshot-types";

const transaction: TransactionSelectorRecord = {
  id: 1,
  issuer: "Citibank Online",
  account_last_four: "4596",
  description: "Grocery",
  amount: "125.00",
  transaction_date: "2026-07-20",
  transaction_type: "purchase",
  category: "groceries",
  plaid_category_detailed: "FOOD_AND_DRINK_GROCERIES",
  pending: false,
  tags: [],
};

const snapshot = {
  citi_current: "400.00",
  citi_pending: "25.00",
} as BankValueSnapshot;

const goal: FinancialGoalInput = {
  goal_type: "flexible",
  name: "Citi pay-period guardrail",
  scope_conditions: [
    {
      id: "scope-account",
      field: "account_last_four",
      operator: "equals",
      value: ["4596"],
    },
  ],
  success_conditions: [
    {
      id: "balance",
      field: "account_balance",
      operator: "less_than_or_equal",
      value: "500",
    },
    {
      id: "period",
      logic_operator: "and",
      field: "spending_period",
      operator: "within",
      value: "2026-07-16..2026-07-31",
    },
    {
      id: "spending",
      logic_operator: "and",
      field: "spending",
      operator: "less_than_or_equal",
      value: "200",
    },
  ],
  tracking_metrics: [
    "days_left_in_pay_cycle",
    "daily_spending_limit",
    "remaining_budget",
    "total_budget",
    "projected_savings",
    "total_credit_card_spend",
  ],
  is_active: true,
};

describe("evaluateFinancialGoal", () => {
  it("evaluates selected account balances and spending in the selected period", () => {
    const result = evaluateFinancialGoal({
      goal,
      transactions: [transaction],
      snapshot,
      currentDate: new Date("2026-07-25T12:00:00"),
      projectedNextPaycheck: 300,
    });

    expect(result.selectedAccountBalance).toBe(425);
    expect(result.spending).toBe(125);
    expect(result.met).toBe(true);
    expect(result.conditions.map((condition) => condition.met)).toEqual([
      true,
      true,
      true,
    ]);
    expect(result.trackingMetrics).toEqual([
      { metric: "days_left_in_pay_cycle", value: 6 },
      { metric: "daily_spending_limit", value: 12.5 },
      { metric: "remaining_budget", value: 75 },
      { metric: "total_budget", value: 200 },
      { metric: "projected_savings", value: 100 },
      { metric: "total_credit_card_spend", value: 425 },
    ]);
  });

  it("sums the selected staging accounts for Current Balances", () => {
    const result = evaluateFinancialGoal({
      goal: {
        ...goal,
        scope_conditions: [
          {
            ...goal.scope_conditions[0],
            value: ["4596", "0277"],
          },
        ],
        success_conditions: [
          {
            id: "current-balances",
            field: "current_balances",
            operator: "equals",
            value: "525",
          },
        ],
      },
      transactions: [transaction],
      snapshot: {
        ...snapshot,
        chase_checking: "100.00",
      },
      currentDate: new Date("2026-07-25T12:00:00"),
    });

    expect(result.selectedAccountBalance).toBe(525);
    expect(
      result.trackingMetrics.find(
        (metric) => metric.metric === "total_credit_card_spend",
      )?.value,
    ).toBe(425);
    expect(result.conditions).toEqual([
      expect.objectContaining({
        field: "current_balances",
        actual: 525,
        met: true,
      }),
    ]);
  });

  it("keeps transactions outside a fixed success period out of spending", () => {
    const result = evaluateFinancialGoal({
      goal,
      transactions: [
        transaction,
        { ...transaction, id: 2, transaction_date: "2026-07-15", amount: "900" },
      ],
      snapshot,
    });

    expect(result.spending).toBe(125);
  });

  it("uses the adjusted balance when a selected card has pending charges", () => {
    const pendingCardTransactions = [
      {
        ...transaction,
        amount: "101.25",
        pending: true,
      },
    ];
    const balanceSnapshot = {
      ...snapshot,
      citi_current: "664.56",
      citi_pending: "0.00",
    };
    const evaluateStatus = (status?: "posted" | "pending" | "both") =>
      evaluateFinancialGoal({
        goal: status
          ? {
              ...goal,
              scope_conditions: [
                ...goal.scope_conditions,
                {
                  id: "status",
                  field: "transaction_status",
                  operator: "equals",
                  value: status,
                  logic_operator: "and",
                },
              ],
            }
          : goal,
        transactions: [transaction],
        pendingCardTransactions,
        snapshot: balanceSnapshot,
      });

    expect(evaluateStatus("posted").selectedAccountBalance).toBeCloseTo(
      664.56,
      2,
    );
    expect(evaluateStatus("pending").selectedAccountBalance).toBeCloseTo(
      101.25,
      2,
    );
    expect(evaluateStatus("both").selectedAccountBalance).toBeCloseTo(
      765.81,
      2,
    );
    expect(evaluateStatus().selectedAccountBalance).toBeCloseTo(765.81, 2);
    expect(
      evaluateStatus("both").trackingMetrics.find(
        (metric) => metric.metric === "total_credit_card_spend",
      )?.value,
    ).toBeCloseTo(765.81, 2);
  });
});

describe("normalizeFinancialGoal", () => {
  it("turns a legacy spending cap into editable scope and success conditions", () => {
    const legacy = {
      id: 7,
      goal_type: "spending",
      name: "Legacy cap",
      target_amount: "1300.00",
      period_mode: "current_pay_period",
      pay_cycle_start: null,
      pay_cycle_end: null,
      is_active: true,
      is_pinned: false,
      created_at: "",
      updated_at: "",
    } satisfies FinancialGoal;

    const normalized = normalizeFinancialGoal(legacy);

    expect(normalized.scope_conditions[0]).toMatchObject({
      field: "pay_period",
      value: "current",
    });
    expect(normalized.success_conditions[0]).toMatchObject({
      field: "spending",
      operator: "less_than_or_equal",
      value: "1300.00",
    });
    expect(normalized.tracking_metrics).toEqual([]);
  });
});
