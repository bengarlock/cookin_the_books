import type { Metadata } from "next";

import { BudgetNavigation } from "@/components/budget-navigation";
import { FinancialGoals } from "@/components/financial-goals";
import { getFinancialGoals } from "@/lib/financial-goals";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getPendingTransactions } from "@/lib/pending-transactions";
import { getIncomeEntries } from "@/lib/income-entries";
import { getBudgetItems } from "@/lib/budget-items";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getExpenseEntries } from "@/lib/expense-entries";

export const metadata: Metadata = { title: "Financial Goals" };

export default async function GoalsPage() {
  const [goals, settings, pendingTransactions, incomeEntries, budgetItems, expenseEntries, creditCardTransactions] = await Promise.all([
    getFinancialGoals(),
    getBudgetPlanSettings(),
    getPendingTransactions(),
    getIncomeEntries(),
    getBudgetItems(),
    getExpenseEntries(),
    getCreditCardTransactions(),
  ]);
  return (
    <div className="w-full">
      <section className="border-b border-white/10 pb-6"><BudgetNavigation /></section>
      <FinancialGoals
        initialGoals={goals}
        incomeEntries={incomeEntries}
        budgetItems={budgetItems}
        expenseEntries={expenseEntries}
        creditCardTransactions={creditCardTransactions}
        nextPaydayOverride={settings.next_payday_override}
        pendingTransactions={pendingTransactions}
      />
    </div>
  );
}
