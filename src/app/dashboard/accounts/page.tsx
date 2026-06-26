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
    <div className="w-full">
      <section className="border-b border-white/10 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
          Accounts
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Account balances
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          Current cash, credit, investment, and retirement balances from the
          latest portfolio snapshot.
        </p>
      </section>

      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialPendingTransactions={pendingTransactions}
        view="accounts"
      />
    </div>
  );
}
