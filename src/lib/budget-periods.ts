export const budgetPeriods = [
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
] as const;

export type BudgetPeriod = (typeof budgetPeriods)[number];

export function amountForBudgetPeriod(
  monthlyAmount: number,
  period: BudgetPeriod,
) {
  switch (period) {
    case "weekly":
      return monthlyAmount / 4;
    case "biweekly":
      return monthlyAmount / 2;
    case "monthly":
      return monthlyAmount;
    case "yearly":
      return monthlyAmount * 12;
  }
}

export function monthlyAmountFromBudgetPeriod(
  amount: number,
  period: BudgetPeriod,
) {
  switch (period) {
    case "weekly":
      return amount * 4;
    case "biweekly":
      return amount * 2;
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
  }
}
