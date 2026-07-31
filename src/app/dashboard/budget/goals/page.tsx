import type { Metadata } from "next";

import { FinancialGoals } from "@/components/financial-goals";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getFinancialGoals } from "@/lib/financial-goals";
import { getIncomeEntries } from "@/lib/income-entries";
import { getPendingTransactions } from "@/lib/pending-transactions";
import { getTransactionSelectorSummary } from "@/lib/transaction-selector-summary";

export const metadata: Metadata = { title: "Financial Goals" };

export default async function GoalsPage() {
  const [
    budgetPlanSettings,
    goals,
    incomeEntries,
    pendingTransactions,
    transactions,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getFinancialGoals(),
    getIncomeEntries(),
    getPendingTransactions(),
    getTransactionSelectorSummary(),
  ]);

  return (
    <FinancialGoals
      initialBudgetPlanSettings={budgetPlanSettings}
      initialGoals={goals}
      initialIncomeEntries={incomeEntries}
      initialPendingTransactions={pendingTransactions}
      initialTransactions={transactions}
    />
  );
}
