import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Accounts",
};

export default async function AccountsPage() {
  const [budgetPlanSettings, pendingTransactions] = await Promise.all([
    getBudgetPlanSettings(),
    getPendingTransactions(),
  ]);

  return (
    <div className="w-full space-y-6">
      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialPendingTransactions={pendingTransactions}
        view="accounts"
      />
    </div>
  );
}
