import type { Metadata } from "next";

import { ProjectionsDashboard } from "@/components/projections-dashboard";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import {
  allTimeExpenseDateRange,
  expenseDateRangeFromSearchParams,
} from "@/lib/expense-date-range";
import { getExpenseTransactions } from "@/lib/expense-transactions";
import { getIncomeEntries } from "@/lib/income-entries";
import { getIncomeTransactions } from "@/lib/income-transactions";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Projections",
};

export default async function ProjectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string | string[]; end?: string | string[] }>;
}) {
  const initialRange = expenseDateRangeFromSearchParams(await searchParams);
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
      initialRange={initialRange}
      initialIncomeEntries={incomeEntries}
      initialIncomeTransactions={incomeTransactions}
      initialPendingTransactions={pendingTransactions}
    />
  );
}
