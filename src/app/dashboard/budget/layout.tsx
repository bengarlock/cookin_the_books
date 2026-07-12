import type { ReactNode } from "react";

import { BudgetDataProvider } from "@/components/budget-data-provider";
import { BudgetNavigation } from "@/components/budget-navigation";
import { getBudgetItems } from "@/lib/budget-items";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getExpenseEntries } from "@/lib/expense-entries";
import { getIncomeEntries } from "@/lib/income-entries";
import { getPendingTransactions } from "@/lib/pending-transactions";

export default async function BudgetLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [
    budgetItems,
    expenseEntries,
    creditCardTransactions,
    incomeEntries,
    pendingTransactions,
    budgetPlanSettings,
  ] = await Promise.all([
    getBudgetItems(),
    getExpenseEntries(),
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
      initialExpenseEntries={expenseEntries}
      initialIncomeEntries={incomeEntries}
      initialPendingTransactions={pendingTransactions}
    >
      <div className="w-full">
        <section className="mb-6">
          <BudgetNavigation />
        </section>
        {children}
      </div>
    </BudgetDataProvider>
  );
}
