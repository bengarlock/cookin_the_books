import { describe, expect, it } from "vitest";

import type { CreditCardTransaction } from "./credit-card-transaction-types";
import { evaluateFinancialGoal, normalizeFinancialGoal } from "./financial-goal-evaluation";
import type { FinancialGoal, FinancialGoalInput } from "./financial-goal-types";
import type { BankValueSnapshot } from "./snapshot-types";

const transaction = {
  id: 1,
  issuer: "Citibank Online",
  account_last_four: "4596",
  description: "Grocery",
  amount: "125.00",
  transaction_date: "2026-07-20",
  transaction_type: "purchase",
  pending: false,
  tags: [],
} as CreditCardTransaction;

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
  is_active: true,
};

describe("evaluateFinancialGoal", () => {
  it("evaluates selected account balances and spending in the selected period", () => {
    const result = evaluateFinancialGoal({
      goal,
      transactions: [transaction],
      snapshot,
      currentDate: new Date("2026-07-25T12:00:00"),
    });

    expect(result.selectedAccountBalance).toBe(425);
    expect(result.spending).toBe(125);
    expect(result.met).toBe(true);
    expect(result.conditions.map((condition) => condition.met)).toEqual([
      true,
      true,
      true,
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
    const result = evaluateFinancialGoal({
      goal,
      transactions: [transaction],
      pendingCardTransactions: [
        {
          ...transaction,
          amount: "101.25",
          pending: true,
        },
      ],
      snapshot: {
        ...snapshot,
        citi_current: "664.56",
        citi_pending: "0.00",
      },
    });

    expect(result.selectedAccountBalance).toBeCloseTo(765.81, 2);
    expect(result.conditions[0].actual).toBeCloseTo(765.81, 2);
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
  });
});
