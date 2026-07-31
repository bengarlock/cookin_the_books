import type { ExpenseAutomationCondition } from "./expense-automation-rule-types";

export function hasSelectedGoalAccounts(
  conditions: ExpenseAutomationCondition[],
) {
  return conditions.some((condition) => {
    if (
      condition.field !== "account_last_four" ||
      condition.operator !== "equals"
    ) {
      return false;
    }
    return Array.isArray(condition.value)
      ? condition.value.length > 0
      : Boolean(condition.value);
  });
}

export function normalizeGoalScopeConditions(
  conditions: ExpenseAutomationCondition[],
) {
  const hasSelectedAccounts = hasSelectedGoalAccounts(conditions);
  return conditions.map((condition) =>
    condition.field === "pay_period" &&
    condition.include_outstanding_pending &&
    (!hasSelectedAccounts || condition.operator !== "equals")
      ? { ...condition, include_outstanding_pending: undefined }
      : condition,
  );
}
