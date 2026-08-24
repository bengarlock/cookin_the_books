export type BudgetPlanSettings = {
  budget_offset: string;
  next_payday_override: string | null;
  overview_tile_order?: string[];
  navigation_preferences?: {
    budget_expanded?: boolean;
  };
  financial_reminder_email?: string;
  account_email?: string;
  created_at?: string;
  updated_at?: string;
};
