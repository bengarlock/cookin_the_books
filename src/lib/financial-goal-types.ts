export type FinancialGoal = {
  id: number;
  goal_type: "spending";
  name: string;
  target_amount: string;
  period_mode: "current_pay_period" | "custom_dates";
  pay_cycle_start: string | null;
  pay_cycle_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinancialGoalInput = Omit<
  FinancialGoal,
  "id" | "created_at" | "updated_at"
>;
