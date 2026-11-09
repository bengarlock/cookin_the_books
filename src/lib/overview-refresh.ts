import type { getOverviewData } from "./overview-data";
import type { BankValueSnapshot } from "./snapshot-types";

type OverviewData = Awaited<ReturnType<typeof getOverviewData>>;
export type OverviewRefresh = { data: OverviewData; snapshot: BankValueSnapshot | null };

// Keep a failed resource from replacing a previously loaded Overview with
// empty/default data. Publish the group only when every required read succeeds.
export async function loadOverviewRefresh(
  read: <T>(path: string) => Promise<T>,
): Promise<OverviewRefresh> {
  const [settings, goals, income, summary, categories, pending, reminders, snapshot] = await Promise.all([
    read<OverviewData["initialBudgetPlanSettings"]>("budget-plan-settings/"),
    read<OverviewData["initialFinancialGoals"]>("financial-goals/"),
    read<OverviewData["initialIncomeEntries"]>("income-entries/"),
    read<{ pending_card_transactions: OverviewData["initialPendingCardTransactions"] }>("credit-card-transactions/dashboard-summary/"),
    read<OverviewData["initialExpenseCategories"]>("expense-categories/"),
    read<OverviewData["initialPendingTransactions"]>("pending-transactions/"),
    read<OverviewData["initialFinancialReminders"]>("financial-reminders/"),
    read<BankValueSnapshot | null>("bank-value-snapshots/latest/"),
  ]);
  const needsTransactions = goals.some((goal) => goal.is_pinned || (goal.pinned_tracking_metrics || []).some((metric) => (goal.tracking_metrics || []).includes(metric)));
  const transactions = needsTransactions
    ? await read<OverviewData["initialGoalTransactions"]>("credit-card-transactions/selector-summary/") : [];
  return {
    snapshot,
    data: {
      initialBudgetPlanSettings: settings,
      initialFinancialGoals: goals,
      initialFinancialReminders: reminders,
      initialGoalTransactions: transactions,
      initialIncomeEntries: income,
      initialPendingCardTransactions: summary.pending_card_transactions,
      initialExpenseCategories: categories,
      initialPendingTransactions: pending,
    },
  };
}
