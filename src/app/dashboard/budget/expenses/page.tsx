import type { Metadata } from "next";

import { BudgetNavigation } from "@/components/budget-navigation";
import { ExpenseHistory } from "@/components/expense-history";
import { getBudgetItems } from "@/lib/budget-items";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getExpenseEntries } from "@/lib/expense-entries";

export const metadata: Metadata = {
  title: "Expenses",
};

export default async function ExpensesPage() {
  const [budgetItems, expenseEntries, creditCardTransactions] =
    await Promise.all([
      getBudgetItems(),
      getExpenseEntries(),
      getCreditCardTransactions(),
    ]);

  return (
    <div className="w-full">
      <section className="border-b border-white/10 pb-6">
        <BudgetNavigation />
      </section>

      <ExpenseHistory
        budgetItems={budgetItems}
        initialCreditCardTransactions={creditCardTransactions}
        initialEntries={expenseEntries}
      />
    </div>
  );
}
