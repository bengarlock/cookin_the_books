import type { Metadata } from "next";

import { BudgetNavigation } from "@/components/budget-navigation";
import { ExpenseHistory } from "@/components/expense-history";
import { getBudgetItems } from "@/lib/budget-items";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getExpenseEntries } from "@/lib/expense-entries";
import { getExpenseTags } from "@/lib/expense-tags";

export const metadata: Metadata = {
  title: "Expenses",
};

export default async function ExpensesPage() {
  const [budgetItems, expenseEntries, creditCardTransactions, expenseTags] =
    await Promise.all([
      getBudgetItems(),
      getExpenseEntries(),
      getCreditCardTransactions(),
      getExpenseTags(),
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
        initialTags={expenseTags}
      />
    </div>
  );
}
