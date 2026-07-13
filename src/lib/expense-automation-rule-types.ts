export type ExpenseAutomationMatchField =
  | "description"
  | "issuer"
  | "transaction_type";

export type ExpenseAutomationMatchOperator = "contains" | "equals" | "not_equals";
export type ExpenseAutomationCondition = {
  id: string;
  logic_operator?: "and" | "or";
  field: "description" | "issuer" | "transaction_type" | "account_last_four" | "amount" | "transaction_date" | "tags";
  operator: "contains" | "not_contains" | "equals" | "not_equals" | "starts_with" | "greater_than" | "greater_than_or_equal" | "less_than" | "less_than_or_equal" | "on_or_after" | "on_or_before";
  value: string | string[];
};
export type ExpenseAutomationAction =
  | { id: string; type: "create_expense"; budget_item: string; note: string; exclude_from_credit_card: boolean }
  | { id: string; type: "assign_tag"; tag: string }
  | { id: string; type: "assign_category"; category: string; category_label?: string }
  | { id: string; type: "set_budget_treatment"; split: boolean; include: boolean };

export type ExpenseAutomationRule = {
  id: number;
  name: string;
  enabled: boolean;
  match_field: ExpenseAutomationMatchField;
  match_operator: ExpenseAutomationMatchOperator;
  match_value: string;
  conditions: ExpenseAutomationCondition[];
  actions: Array<
    | { type: "create_expense"; budget_item: string | number; note: string; exclude_from_credit_card: boolean }
    | { type: "assign_tag"; tag: string }
    | { type: "assign_category"; category: string; category_label?: string }
    | { type: "set_budget_treatment"; split: boolean; include: boolean }
  >;
  logic_operator: "and" | "or";
  target_budget_item: number;
  note_template: string;
  exclude_from_credit_card: boolean;
  created_at: string;
  updated_at: string;
};

export type ExpenseAutomationRunResult = {
  created: Array<{
    id: number;
    budget_item: number;
    incurred_on: string;
    amount: string;
    note: string;
    source_type: string;
    source_identifier: string;
    created_at: string;
    updated_at: string;
  }>;
  created_count: number;
  skipped_duplicate_count: number;
  processed_count: number;
};
