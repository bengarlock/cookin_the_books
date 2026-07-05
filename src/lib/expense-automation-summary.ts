import type { BudgetItem } from "./budget-item-types";
import type { ExpenseAutomationRule } from "./expense-automation-rule-types";

const categoryLabels: Record<string, string> = {
  dining: "Dining",
  groceries: "Groceries",
  transportation: "Transportation",
  housing: "Housing",
  utilities: "Utilities",
  shopping: "Shopping",
  health: "Health",
  entertainment: "Entertainment",
  travel: "Travel",
  subscriptions: "Subscriptions",
  fees_interest: "Fees & interest",
  transfer: "Transfer",
};

function joinActions(actions: string[]) {
  const continueSentence = (action: string) =>
    `${action.charAt(0).toLowerCase()}${action.slice(1)}`;
  if (actions.length < 2) return actions[0] || "No actions configured";
  if (actions.length === 2)
    return `${actions[0]} and ${continueSentence(actions[1])}`;
  return `${actions.slice(0, -1).join(", ")}, and ${continueSentence(actions.at(-1) || "")}`;
}

export function formatAutomationActionSummary(
  rule: ExpenseAutomationRule,
  budgetItemsById: Map<number, BudgetItem>,
) {
  const actions = rule.actions?.length
    ? rule.actions
    : rule.target_budget_item
      ? [
          {
            type: "create_expense" as const,
            budget_item: rule.target_budget_item,
            note: rule.note_template,
            exclude_from_credit_card: rule.exclude_from_credit_card,
          },
        ]
      : [];

  return joinActions(
    actions.map((action) => {
      if (action.type === "assign_tag") return `Assign tag: ${action.tag}`;
      if (action.type === "assign_category") {
        const label = action.category_label || categoryLabels[action.category] || action.category;
        return action.category === "transfer"
          ? "Mark as Transfer"
          : `Categorize as ${label}`;
      }
      const target =
        budgetItemsById.get(Number(action.budget_item))?.label || "Expense";
      return `Categorize as ${target}${action.note.trim() ? " and set note" : ""}`;
    }),
  );
}
