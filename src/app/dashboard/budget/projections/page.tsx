import type { Metadata } from "next";

import { ProjectionsDashboard } from "@/components/projections-dashboard";
import { getBudgetAverageTransactions } from "@/lib/budget-average-transactions";
import { getBudgetItems } from "@/lib/budget-items";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getExpenseEntries } from "@/lib/expense-entries";
import { getIncomeEntries } from "@/lib/income-entries";
import { getIncomeTransactions } from "@/lib/income-transactions";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Projections",
};

export default async function ProjectionsPage() {
  const [
    budgetItems,
    budgetPlanSettings,
    creditCardTransactions,
    expenseEntries,
    incomeEntries,
    incomeTransactions,
    pendingTransactions,
  ] = await Promise.all([
    getBudgetItems(),
    getBudgetPlanSettings(),
    getBudgetAverageTransactions(),
    getExpenseEntries(),
    getIncomeEntries(),
    getIncomeTransactions(),
    getPendingTransactions(),
  ]);

  return (
    <ProjectionsDashboard
      initialBudgetItems={budgetItems}
      initialBudgetPlanSettings={budgetPlanSettings}
      initialCreditCardTransactions={creditCardTransactions}
      initialExpenseEntries={expenseEntries}
      initialIncomeEntries={incomeEntries}
      initialIncomeTransactions={incomeTransactions}
      initialPendingTransactions={pendingTransactions}
    />
  );
}
