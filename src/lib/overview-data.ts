import "server-only";

import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getDashboardPendingCardTransactions } from "@/lib/dashboard-pending-card-transactions";
import { getExpenseCategories } from "@/lib/expense-categories";
import { getFinancialGoals } from "@/lib/financial-goals";
import { getFinancialReminders } from "@/lib/financial-reminders";
import { getIncomeEntries } from "@/lib/income-entries";
import { getPendingTransactions } from "@/lib/pending-transactions";
import { getTransactionSelectorSummary } from "@/lib/transaction-selector-summary";

export async function getOverviewData() {
  const [
    budgetPlanSettings,
    financialGoals,
    incomeEntries,
    pendingCardTransactions,
    expenseCategories,
    pendingTransactions,
    financialReminders,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getFinancialGoals(),
    getIncomeEntries(),
    getDashboardPendingCardTransactions(),
    getExpenseCategories(),
    getPendingTransactions(),
    getFinancialReminders(),
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

  return {
    initialBudgetPlanSettings: budgetPlanSettings,
    initialFinancialGoals: financialGoals,
    initialFinancialReminders: financialReminders,
    initialGoalTransactions: goalTransactions,
    initialIncomeEntries: incomeEntries,
    initialPendingCardTransactions: pendingCardTransactions,
    initialExpenseCategories: expenseCategories,
    initialPendingTransactions: pendingTransactions,
  };
}
