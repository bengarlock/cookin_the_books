import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getDashboardPendingCardTransactions } from "@/lib/dashboard-pending-card-transactions";
import { getExpenseCategories } from "@/lib/expense-categories";
import { getFinancialGoals } from "@/lib/financial-goals";
import { getIncomeEntries } from "@/lib/income-entries";
import { getPendingTransactions } from "@/lib/pending-transactions";
import { getTransactionSelectorSummary } from "@/lib/transaction-selector-summary";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const [
    budgetPlanSettings,
    financialGoals,
    incomeEntries,
    pendingCardTransactions,
    expenseCategories,
    pendingTransactions,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getFinancialGoals(),
    getIncomeEntries(),
    getDashboardPendingCardTransactions(),
    getExpenseCategories(),
    getPendingTransactions(),
  ]);
  const needsGoalTransactions = financialGoals.some(
    (goal) =>
      goal.is_pinned ||
      (goal.pinned_tracking_metrics || []).some((metric) =>
        (goal.tracking_metrics || []).includes(metric),
      ),
  );
  const goalTransactions = needsGoalTransactions
    ? await getTransactionSelectorSummary()
    : [];

  return (
    <div className="w-full">
      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialFinancialGoals={financialGoals}
        initialGoalTransactions={goalTransactions}
        initialIncomeEntries={incomeEntries}
        initialPendingCardTransactions={pendingCardTransactions}
        initialExpenseCategories={expenseCategories}
        initialPendingTransactions={pendingTransactions}
        view="overview"
      />
    </div>
  );
}
