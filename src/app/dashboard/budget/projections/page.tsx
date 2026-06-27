import type { Metadata } from "next";

import { BudgetNavigation } from "@/components/budget-navigation";
import { ProjectionsDashboard } from "@/components/projections-dashboard";
import { getBudgetItems } from "@/lib/budget-items";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getExpenseEntries } from "@/lib/expense-entries";
import { getIncomeEntries } from "@/lib/income-entries";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Projections",
};

export default async function ProjectionsPage() {
  const [
    incomeEntries,
    pendingTransactions,
    budgetItems,
    expenseEntries,
    creditCardTransactions,
  ] = await Promise.all([
    getIncomeEntries(),
    getPendingTransactions(),
    getBudgetItems(),
    getExpenseEntries(),
    getCreditCardTransactions(),
  ]);

  return (
    <div className="w-full">
      <section className="border-b border-white/10 pb-6">
        <BudgetNavigation />
      </section>

      <ProjectionsDashboard
        budgetItems={budgetItems}
        creditCardTransactions={creditCardTransactions}
        expenseEntries={expenseEntries}
        initialIncomeEntries={incomeEntries}
        initialPendingTransactions={pendingTransactions}
      />
    </div>
  );
}
