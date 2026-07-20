import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getDashboardPendingCardTransactions } from "@/lib/dashboard-pending-card-transactions";
import { getExpenseCategories } from "@/lib/expense-categories";
import { getPendingTransactions } from "@/lib/pending-transactions";
import { getExpenseTags } from "@/lib/expense-tags";

export const metadata: Metadata = {
  title: "Accounts",
};

export default async function AccountsPage() {
  const [
    budgetPlanSettings,
    pendingCardTransactions,
    expenseCategories,
    pendingTransactions,
    expenseTags,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getDashboardPendingCardTransactions(),
    getExpenseCategories(),
    getPendingTransactions(),
    getExpenseTags(),
  ]);

  return (
    <div className="w-full space-y-6">
      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialPendingCardTransactions={pendingCardTransactions}
        initialExpenseCategories={expenseCategories}
        initialPendingTransactions={pendingTransactions}
        initialExpenseTags={expenseTags}
        view="accounts"
      />
    </div>
  );
}
