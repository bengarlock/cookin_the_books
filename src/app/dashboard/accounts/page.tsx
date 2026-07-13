import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getExpenseCategories } from "@/lib/expense-categories";
import { getPendingTransactions } from "@/lib/pending-transactions";
import { getExpenseTags } from "@/lib/expense-tags";

export const metadata: Metadata = {
  title: "Accounts",
};

export default async function AccountsPage() {
  const [budgetPlanSettings, expenseCategories, pendingTransactions, expenseTags] = await Promise.all([
    getBudgetPlanSettings(),
    getExpenseCategories(),
    getPendingTransactions(),
    getExpenseTags(),
  ]);

  return (
    <div className="w-full space-y-6">
      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialExpenseCategories={expenseCategories}
        initialPendingTransactions={pendingTransactions}
        initialExpenseTags={expenseTags}
        view="accounts"
      />
    </div>
  );
}
