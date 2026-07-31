import type { ReactNode } from "react";

import { BudgetDataProvider } from "@/components/budget-data-provider";
import { getBudgetItems } from "@/lib/budget-items";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getExpenseCategories } from "@/lib/expense-categories";
import { getExpenseEntries } from "@/lib/expense-entries";
import { getIncomeEntries } from "@/lib/income-entries";
import { getPendingTransactions } from "@/lib/pending-transactions";

export default async function FullBudgetDataLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [
    budgetItems,
    expenseEntries,
    expenseCategories,
    creditCardTransactions,
    incomeEntries,
    pendingTransactions,
    budgetPlanSettings,
  ] = await Promise.all([
    getBudgetItems(),
    getExpenseEntries(),
    getExpenseCategories(),
    getCreditCardTransactions(),
    getIncomeEntries(),
    getPendingTransactions(),
    getBudgetPlanSettings(),
  ]);

  return (
    <BudgetDataProvider
      initialBudgetItems={budgetItems}
      initialBudgetPlanSettings={budgetPlanSettings}
      initialCreditCardTransactions={creditCardTransactions}
      initialExpenseCategories={expenseCategories}
      initialExpenseEntries={expenseEntries}
      initialIncomeEntries={incomeEntries}
      initialPendingTransactions={pendingTransactions}
    >
      {children}
    </BudgetDataProvider>
  );
}
