export type FinancialGoal = {
  id: number;
  goal_type: "spending";
  name: string;
  target_amount: string;
  pay_cycle_start: string;
  pay_cycle_end: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinancialGoalInput = Omit<
  FinancialGoal,
  "id" | "created_at" | "updated_at"
>;
