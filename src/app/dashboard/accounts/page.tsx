import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { PlaidConnections } from "@/components/plaid-connections";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getPendingTransactions } from "@/lib/pending-transactions";
import { getPlaidConnections } from "@/lib/plaid-connections";

export const metadata: Metadata = {
  title: "Accounts",
};

export default async function AccountsPage() {
  const [budgetPlanSettings, pendingTransactions, plaidConnections] = await Promise.all([
    getBudgetPlanSettings(),
    getPendingTransactions(),
    getPlaidConnections(),
  ]);

  return (
    <div className="w-full space-y-6">
      <PlaidConnections initialConnections={plaidConnections} />
      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialPendingTransactions={pendingTransactions}
        view="accounts"
      />
    </div>
  );
}
