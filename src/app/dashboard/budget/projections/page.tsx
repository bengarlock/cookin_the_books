import type { Metadata } from "next";

import { BudgetNavigation } from "@/components/budget-navigation";
import { ProjectionsDashboard } from "@/components/projections-dashboard";
import { getBudgetItems } from "@/lib/budget-items";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getExpenseEntries } from "@/lib/expense-entries";
import { getIncomeEntries } from "@/lib/income-entries";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Projections",
};

export default async function ProjectionsPage() {
  const [
    incomeEntries,
    pendingTransactions,
    budgetItems,
    expenseEntries,
    creditCardTransactions,
    budgetPlanSettings,
  ] = await Promise.all([
    getIncomeEntries(),
    getPendingTransactions(),
    getBudgetItems(),
    getExpenseEntries(),
    getCreditCardTransactions(),
    getBudgetPlanSettings(),
  ]);

  return (
    <div className="w-full">
      <section className="border-b border-white/10 pb-6">
        <BudgetNavigation />
      </section>

      <ProjectionsDashboard
        budgetItems={budgetItems}
        creditCardTransactions={creditCardTransactions}
        expenseEntries={expenseEntries}
        initialBudgetPlanSettings={budgetPlanSettings}
        initialIncomeEntries={incomeEntries}
        initialPendingTransactions={pendingTransactions}
      />
    </div>
  );
}
