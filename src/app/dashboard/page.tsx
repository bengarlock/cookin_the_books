import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getDashboardPendingCardTransactions } from "@/lib/dashboard-pending-card-transactions";
import { getExpenseCategories } from "@/lib/expense-categories";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const [
    budgetPlanSettings,
    pendingCardTransactions,
    expenseCategories,
    pendingTransactions,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getDashboardPendingCardTransactions(),
    getExpenseCategories(),
    getPendingTransactions(),
  ]);

  return (
    <div className="w-full">
      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialPendingCardTransactions={pendingCardTransactions}
        initialExpenseCategories={expenseCategories}
        initialPendingTransactions={pendingTransactions}
        view="overview"
      />
    </div>
  );
}
