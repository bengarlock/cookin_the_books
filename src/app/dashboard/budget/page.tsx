import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { RecurringExpenses } from "@/components/recurring-expenses";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getDashboardPendingCardTransactions } from "@/lib/dashboard-pending-card-transactions";
import { getExpenseCategories } from "@/lib/expense-categories";
import {
  allTimeExpenseDateRange,
  expenseDateRangeFromSearchParams,
} from "@/lib/expense-date-range";
import { getExpenseTransactions } from "@/lib/expense-transactions";
import { getIncomeEntries } from "@/lib/income-entries";
import { getIncomeTransactions } from "@/lib/income-transactions";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Budget",
};

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string | string[]; end?: string | string[] }>;
}) {
  const initialRange = expenseDateRangeFromSearchParams(await searchParams);
  const [
    budgetPlanSettings,
    expenseCategories,
    expenseTransactions,
    incomeEntries,
    incomeTransactions,
    pendingCardTransactions,
    pendingTransactions,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getExpenseCategories(),
    getExpenseTransactions(allTimeExpenseDateRange()),
    getIncomeEntries(),
    getIncomeTransactions(),
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
        budgetPlanSettings={budgetPlanSettings}
        incomeEntries={incomeEntries}
        incomeTransactions={incomeTransactions}
        pendingTransactions={pendingTransactions}
        initialRange={initialRange}
        transactions={expenseTransactions}
      />
    </>
  );
}
