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
      <section className="border-b border-white/10 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
          Budget
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Recurring expenses
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          Track ongoing costs such as utilities, property taxes, insurance, and
          other repeating obligations.
        </p>
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
