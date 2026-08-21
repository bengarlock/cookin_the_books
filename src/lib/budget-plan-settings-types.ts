export type BudgetPlanSettings = {
  budget_offset: string;
  next_payday_override: string | null;
  overview_tile_order?: string[];
  navigation_preferences?: {
    budget_expanded?: boolean;
  };
  created_at?: string;
  updated_at?: string;
};
