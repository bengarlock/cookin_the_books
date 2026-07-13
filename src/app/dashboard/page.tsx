import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getExpenseCategories } from "@/lib/expense-categories";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const [budgetPlanSettings, expenseCategories, pendingTransactions] = await Promise.all([
    getBudgetPlanSettings(),
    getExpenseCategories(),
    getPendingTransactions(),
  ]);

  return (
    <div className="w-full">
      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialExpenseCategories={expenseCategories}
        initialPendingTransactions={pendingTransactions}
        view="overview"
      />
    </div>
  );
}
