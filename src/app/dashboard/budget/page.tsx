import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { RecurringExpenses } from "@/components/recurring-expenses";
import { getBudgetAverageTransactions } from "@/lib/budget-average-transactions";
import { getBudgetItems } from "@/lib/budget-items";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getDashboardPendingCardTransactions } from "@/lib/dashboard-pending-card-transactions";
import { getExpenseEntries } from "@/lib/expense-entries";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Budget",
};

export default async function BudgetPage() {
  const [
    budgetItems,
    budgetPlanSettings,
    creditCardTransactions,
    expenseEntries,
    pendingCardTransactions,
    pendingTransactions,
  ] = await Promise.all([
    getBudgetItems(),
    getBudgetPlanSettings(),
    getBudgetAverageTransactions(),
    getExpenseEntries(),
    getDashboardPendingCardTransactions(),
    getPendingTransactions(),
  ]);

  return (
    <>
      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialPendingCardTransactions={pendingCardTransactions}
        initialPendingTransactions={pendingTransactions}
        view="budget"
      />
      <RecurringExpenses
        budgetItems={budgetItems}
        creditCardTransactions={creditCardTransactions}
        expenseEntries={expenseEntries}
      />
    </>
  );
}
