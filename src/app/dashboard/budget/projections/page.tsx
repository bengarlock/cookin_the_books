import type { Metadata } from "next";

import { ProjectionsDashboard } from "@/components/projections-dashboard";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { allTimeExpenseDateRange } from "@/lib/expense-date-range";
import { getExpenseTransactions } from "@/lib/expense-transactions";
import { getIncomeEntries } from "@/lib/income-entries";
import { getIncomeTransactions } from "@/lib/income-transactions";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Projections",
};

export default async function ProjectionsPage() {
  const [
    budgetPlanSettings,
    categorizedTransactions,
    incomeEntries,
    incomeTransactions,
    pendingTransactions,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getExpenseTransactions(allTimeExpenseDateRange()),
    getIncomeEntries(),
    getIncomeTransactions(),
    getPendingTransactions(),
  ]);

  return (
    <ProjectionsDashboard
      initialBudgetPlanSettings={budgetPlanSettings}
      initialCategorizedTransactions={categorizedTransactions}
      initialIncomeEntries={incomeEntries}
      initialIncomeTransactions={incomeTransactions}
      initialPendingTransactions={pendingTransactions}
    />
  );
}
