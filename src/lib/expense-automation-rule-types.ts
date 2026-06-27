export type ExpenseAutomationMatchField =
  | "description"
  | "issuer"
  | "transaction_type";

export type ExpenseAutomationMatchOperator = "contains" | "equals";

export type ExpenseAutomationRule = {
  id: number;
  name: string;
  enabled: boolean;
  match_field: ExpenseAutomationMatchField;
  match_operator: ExpenseAutomationMatchOperator;
  match_value: string;
  target_budget_item: number;
  note_template: string;
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
};
