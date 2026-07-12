import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getPendingTransactions } from "@/lib/pending-transactions";
import { getExpenseTags } from "@/lib/expense-tags";

export const metadata: Metadata = {
  title: "Accounts",
};

export default async function AccountsPage() {
  const [budgetPlanSettings, pendingTransactions, expenseTags] = await Promise.all([
    getBudgetPlanSettings(),
    getPendingTransactions(),
    getExpenseTags(),
  ]);

  return (
    <div className="w-full space-y-6">
      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialPendingTransactions={pendingTransactions}
        initialExpenseTags={expenseTags}
        view="accounts"
      />
    </div>
  );
}
