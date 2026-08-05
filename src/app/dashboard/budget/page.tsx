import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { RecurringExpenses } from "@/components/recurring-expenses";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getDashboardPendingCardTransactions } from "@/lib/dashboard-pending-card-transactions";
import { getExpenseCategories } from "@/lib/expense-categories";
import { allTimeExpenseDateRange } from "@/lib/expense-date-range";
import { getExpenseTransactions } from "@/lib/expense-transactions";
import { getExpenseEntries } from "@/lib/expense-entries";
import { getIncomeEntries } from "@/lib/income-entries";
import { getIncomeTransactions } from "@/lib/income-transactions";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Budget",
};

export default async function BudgetPage() {
  const [
    budgetPlanSettings,
    expenseCategories,
    expenseTransactions,
    expenseEntries,
    incomeEntries,
    incomeTransactions,
    pendingCardTransactions,
    pendingTransactions,
  ] = await Promise.all([
    getBudgetPlanSettings(),
    getExpenseCategories(),
    getExpenseTransactions(allTimeExpenseDateRange()),
    getExpenseEntries(),
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
        propertyTaxExpenses={expenseEntries
          .filter(
            (entry) =>
              entry.source_type === "property_tax_pdf" &&
              !entry.exclude_from_credit_card,
          )
          .map((entry) => ({
            amount: entry.amount,
            category: "property_taxes",
            incurred_on: entry.incurred_on,
          }))}
        transactions={expenseTransactions}
      />
    </>
  );
}
