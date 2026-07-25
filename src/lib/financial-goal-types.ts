import type { ExpenseAutomationCondition } from "./expense-automation-rule-types";

export type FinancialGoalCondition = {
  id: string;
  logic_operator?: "and" | "or";
  field: "account_balance" | "spending" | "spending_period";
  operator:
    | "equals"
    | "not_equals"
    | "greater_than"
    | "greater_than_or_equal"
    | "less_than"
    | "less_than_or_equal"
    | "within"
    | "not_within";
  value: string;
};

export type FinancialGoal = {
  id: number;
  goal_type: "spending" | "flexible";
  name: string;
  target_amount: string | null;
  period_mode: "current_pay_period" | "custom_dates" | null;
  pay_cycle_start: string | null;
  pay_cycle_end: string | null;
  scope_conditions?: ExpenseAutomationCondition[];
  success_conditions?: FinancialGoalCondition[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinancialGoalInput = {
  goal_type: "flexible";
  name: string;
  scope_conditions: ExpenseAutomationCondition[];
  success_conditions: FinancialGoalCondition[];
  is_active: boolean;
};
