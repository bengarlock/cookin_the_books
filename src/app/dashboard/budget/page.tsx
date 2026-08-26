import type { Metadata } from "next";
import { Suspense } from "react";

import { BudgetLoading } from "@/components/budget-loading";
import { LiveBankValues } from "@/components/live-bank-values";
import { RecurringExpenses } from "@/components/recurring-expenses";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getDashboardPendingCardTransactions } from "@/lib/dashboard-pending-card-transactions";
import { getExpenseCategories } from "@/lib/expense-categories";
import { expenseDateRangeFromSearchParams } from "@/lib/expense-date-range";
import { getFinancialReminders } from "@/lib/financial-reminders";
import { getIncomeEntries } from "@/lib/income-entries";
import { getIncomeTransactions } from "@/lib/income-transactions";
import { getPendingTransactions } from "@/lib/pending-transactions";
import { planExpenseTransactionRanges } from "@/lib/plan-expense-date-ranges";
import { getPlanExpenseTransactions } from "@/lib/plan-expense-transactions";

export const metadata: Metadata = {
  title: "Budget",
};

type BudgetPageProps = {
  searchParams: Promise<{ start?: string | string[]; end?: string | string[] }>;
};

export default function BudgetPage({ searchParams }: BudgetPageProps) {
  return (
    <Suspense fallback={<BudgetLoading />}>
      <BudgetPlanContent searchParams={searchParams} />
    </Suspense>
  );
}

async function BudgetPlanContent({
  searchParams,
}: BudgetPageProps) {
  const initialRange = expenseDateRangeFromSearchParams(await searchParams);
  const transactionRanges = planExpenseTransactionRanges(initialRange);
  const [
    budgetPlanSettings,
    expenseCategories,
    expenseTransactions,
    incomeEntries,
    incomeTransactions,
    pendingCardTransactions,
    pendingTransactions,
    financialReminders,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getExpenseCategories(),
    getPlanExpenseTransactions(transactionRanges),
    getIncomeEntries(),
    getIncomeTransactions(),
    getDashboardPendingCardTransactions(),
    getPendingTransactions(),
    getFinancialReminders(),
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
        financialReminders={financialReminders}
        initialRange={initialRange}
        transactions={expenseTransactions}
      />
    </>
  );
}
