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
      <section className="border-b border-white/10 pb-6">
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
