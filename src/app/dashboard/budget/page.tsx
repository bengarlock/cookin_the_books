import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { RecurringExpenses } from "@/components/recurring-expenses";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getDashboardPendingCardTransactions } from "@/lib/dashboard-pending-card-transactions";
import { getExpenseCategories } from "@/lib/expense-categories";
import { allTimeExpenseDateRange } from "@/lib/expense-date-range";
import { getExpenseTransactions } from "@/lib/expense-transactions";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Budget",
};

export default async function BudgetPage() {
  const [
    budgetPlanSettings,
    expenseCategories,
    expenseTransactions,
    pendingCardTransactions,
    pendingTransactions,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getExpenseCategories(),
    getExpenseTransactions(allTimeExpenseDateRange()),
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
        categories={expenseCategories}
        transactions={expenseTransactions}
      />
    </>
  );
}
