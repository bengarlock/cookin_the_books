import type { Metadata } from "next";

import { ProjectionsDashboard } from "@/components/projections-dashboard";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { allTimeExpenseDateRange } from "@/lib/expense-date-range";
import { getExpenseTransactions } from "@/lib/expense-transactions";
import { getExpenseEntries } from "@/lib/expense-entries";
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
    expenseEntries,
    incomeEntries,
    incomeTransactions,
    pendingTransactions,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getExpenseTransactions(allTimeExpenseDateRange()),
    getExpenseEntries(),
    getIncomeEntries(),
    getIncomeTransactions(),
    getPendingTransactions(),
  ]);

  return (
    <ProjectionsDashboard
      initialBudgetPlanSettings={budgetPlanSettings}
      initialCategorizedTransactions={categorizedTransactions}
      initialPropertyTaxExpenses={expenseEntries
        .filter(
          (entry) =>
            entry.source_type === "property_tax_pdf" &&
            !entry.exclude_from_credit_card,
        )
        .map((entry) => ({
          amount: entry.amount,
          category: "property_taxes",
          incurred_on: entry.incurred_on,
        }))}
      initialIncomeEntries={incomeEntries}
      initialIncomeTransactions={incomeTransactions}
      initialPendingTransactions={pendingTransactions}
    />
  );
}
