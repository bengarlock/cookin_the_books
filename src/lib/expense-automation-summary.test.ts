import { describe, expect, it } from "vitest";

import { formatAutomationActionSummary } from "./expense-automation-summary";
import type { ExpenseAutomationRule } from "./expense-automation-rule-types";

const baseRule = {
  id: 1,
  name: "Rule",
  enabled: true,
  match_field: "description",
  match_operator: "contains",
  match_value: "ignored condition",
  conditions: [],
  logic_operator: "and",
  target_budget_item: 0,
  note_template: "",
  exclude_from_credit_card: true,
  created_at: "",
  updated_at: "",
} satisfies Omit<ExpenseAutomationRule, "actions">;

const budgetItems = new Map([
  [7, { id: 7, label: "Utilities" }],
]) as Parameters<typeof formatAutomationActionSummary>[1];

describe("formatAutomationActionSummary", () => {
  it("summarizes only the resulting tag action", () => {
    expect(
      formatAutomationActionSummary(
        { ...baseRule, actions: [{ type: "assign_tag", tag: "Groceries" }] },
        budgetItems,
      ),
    ).toBe("Assign tag: Groceries");
  });

  it("summarizes expense category and note actions", () => {
    expect(
      formatAutomationActionSummary(
        {
          ...baseRule,
          actions: [
            {
              type: "create_expense",
              budget_item: 7,
              note: "Monthly bill",
              exclude_from_credit_card: true,
            },
          ],
        },
        budgetItems,
      ),
    ).toBe("Categorize as Utilities and set note");
  });

  it("combines multiple resulting actions", () => {
    expect(
      formatAutomationActionSummary(
        {
          ...baseRule,
          actions: [
            { type: "assign_tag", tag: "Dining" },
            { type: "assign_category", category: "utilities" },
          ],
        },
        budgetItems,
      ),
    ).toBe("Assign tag: Dining and categorize as Utilities");
  });

  it("summarizes budget treatment", () => {
    expect(
      formatAutomationActionSummary(
        {
          ...baseRule,
          actions: [
            {
              type: "set_budget_treatment",
              split: true,
              include: false,
            },
          ],
        },
        budgetItems,
      ),
    ).toBe("Budget treatment: Split, Excluded");
  });
});
