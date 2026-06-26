import type { Metadata } from "next";

import { BudgetNavigation } from "@/components/budget-navigation";
import { LiveBankValues } from "@/components/live-bank-values";
import { RecurringExpenses } from "@/components/recurring-expenses";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getBudgetItems } from "@/lib/budget-items";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Budget",
};

export default async function BudgetPage() {
  const [budgetPlanSettings, pendingTransactions, budgetItems] = await Promise.all([
    getBudgetPlanSettings(),
    getPendingTransactions(),
    getBudgetItems(),
  ]);

  return (
    <div className="w-full">
      <section className="border-b border-white/10 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
          Budget
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Pay-cycle planning
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          Budget availability, daily spending guidance, and cash-position
          details calculated from live account balances.
        </p>
        <BudgetNavigation />
      </section>

      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialPendingTransactions={pendingTransactions}
        view="budget"
      />
      <RecurringExpenses initialItems={budgetItems} />
    </div>
  );
}
