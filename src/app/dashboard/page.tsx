import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getExpenseCategories } from "@/lib/expense-categories";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const [
    budgetPlanSettings,
    creditCardTransactions,
    expenseCategories,
    pendingTransactions,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getCreditCardTransactions(),
    getExpenseCategories(),
    getPendingTransactions(),
  ]);

  return (
    <div className="w-full">
      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialCreditCardTransactions={creditCardTransactions}
        initialExpenseCategories={expenseCategories}
        initialPendingTransactions={pendingTransactions}
        view="overview"
      />
    </div>
  );
}
