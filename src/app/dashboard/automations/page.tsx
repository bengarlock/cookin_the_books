import type { Metadata } from "next";

import { AutomationsDashboard } from "@/components/automations-dashboard";
import { getBudgetItems } from "@/lib/budget-items";
import { getTransactionSelectorSummary } from "@/lib/transaction-selector-summary";
import { getExpenseCategories } from "@/lib/expense-categories";
import { getExpenseAutomationRules } from "@/lib/expense-automation-rules";
import { getExpenseTags } from "@/lib/expense-tags";

export const metadata: Metadata = {
  title: "Automations",
};

export default async function AutomationsPage() {
  const [budgetItems, creditCardTransactions, expenseCategories, rules, expenseTags] = await Promise.all([
    getBudgetItems(),
    getTransactionSelectorSummary(),
    getExpenseCategories(),
    getExpenseAutomationRules(),
    getExpenseTags(),
  ]);

  return (
    <div className="w-full">
      <AutomationsDashboard
        initialBudgetItems={budgetItems}
        initialCategories={expenseCategories}
        initialCreditCardTransactions={creditCardTransactions}
        initialRules={rules}
        initialTags={expenseTags}
      />
    </div>
  );
}
