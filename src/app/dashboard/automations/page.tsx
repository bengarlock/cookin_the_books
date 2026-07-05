import type { Metadata } from "next";

import { AutomationsDashboard } from "@/components/automations-dashboard";
import { getBudgetItems } from "@/lib/budget-items";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getExpenseAutomationRules } from "@/lib/expense-automation-rules";
import { getExpenseTags } from "@/lib/expense-tags";

export const metadata: Metadata = {
  title: "Automations",
};

export default async function AutomationsPage() {
  const [budgetItems, creditCardTransactions, rules, expenseTags] = await Promise.all([
    getBudgetItems(),
    getCreditCardTransactions(),
    getExpenseAutomationRules(),
    getExpenseTags(),
  ]);

  return (
    <div className="w-full">
      <AutomationsDashboard
        initialBudgetItems={budgetItems}
        initialCreditCardTransactions={creditCardTransactions}
        initialRules={rules}
        initialTags={expenseTags}
      />
    </div>
  );
}
