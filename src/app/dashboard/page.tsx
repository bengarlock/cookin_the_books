import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getDashboardPendingCardTransactions } from "@/lib/dashboard-pending-card-transactions";
import { getExpenseCategories } from "@/lib/expense-categories";
import { getFinancialGoals } from "@/lib/financial-goals";
import { getIncomeEntries } from "@/lib/income-entries";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const [
    budgetPlanSettings,
    creditCardTransactions,
    financialGoals,
    incomeEntries,
    pendingCardTransactions,
    expenseCategories,
    pendingTransactions,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getCreditCardTransactions(),
    getFinancialGoals(),
    getIncomeEntries(),
    getDashboardPendingCardTransactions(),
    getExpenseCategories(),
    getPendingTransactions(),
  ]);

  return (
    <div className="w-full">
      <LiveBankValues
        initialBudgetPlanSettings={budgetPlanSettings}
        initialCreditCardTransactions={creditCardTransactions}
        initialFinancialGoals={financialGoals}
        initialIncomeEntries={incomeEntries}
        initialPendingCardTransactions={pendingCardTransactions}
        initialExpenseCategories={expenseCategories}
        initialPendingTransactions={pendingTransactions}
        view="overview"
      />
    </div>
  );
}
