import type { Metadata } from "next";

import { AutomationsDashboard } from "@/components/automations-dashboard";
import { getBudgetItems } from "@/lib/budget-items";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getExpenseAutomationRules } from "@/lib/expense-automation-rules";
import { getExpenseCategoryRules } from "@/lib/expense-category-rules";

export const metadata: Metadata = {
  title: "Automations",
};

export default async function AutomationsPage() {
  const [budgetItems, creditCardTransactions, rules, categoryRules] = await Promise.all([
    getBudgetItems(),
    getCreditCardTransactions(),
    getExpenseAutomationRules(),
    getExpenseCategoryRules(),
  ]);

  return (
    <div className="w-full">
      <AutomationsDashboard
        initialBudgetItems={budgetItems}
        initialCreditCardTransactions={creditCardTransactions}
        initialRules={rules}
        initialCategoryRules={categoryRules}
      />
    </div>
  );
}
