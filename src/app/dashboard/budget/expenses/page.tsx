import type { Metadata } from "next";

import { ExpenseHistory } from "@/components/expense-history";
import { getBudgetItems } from "@/lib/budget-items";
import { getExpenseCategories } from "@/lib/expense-categories";
import { defaultExpenseDateRange } from "@/lib/expense-date-range";
import { getExpenseEntries } from "@/lib/expense-entries";
import { getExpenseTags } from "@/lib/expense-tags";
import {
  getExpenseTransactionMetadata,
  getExpenseTransactions,
} from "@/lib/expense-transactions";

export const metadata: Metadata = {
  title: "Expenses",
};

export default async function ExpensesPage() {
  const initialRange = defaultExpenseDateRange();
  const [
    budgetItems,
    expenseEntries,
    expenseCategories,
    expenseTags,
    expenseTransactions,
    expenseTransactionMetadata,
  ] = await Promise.all([
    getBudgetItems(),
    getExpenseEntries(),
    getExpenseCategories(),
    getExpenseTags(),
    getExpenseTransactions(initialRange),
    getExpenseTransactionMetadata(),
  ]);

  return (
    <ExpenseHistory
      initialBudgetItems={budgetItems}
      initialCategories={expenseCategories}
      initialEntries={expenseEntries}
      initialRange={initialRange}
      initialTags={expenseTags}
      initialTransactionMetadata={expenseTransactionMetadata}
      initialTransactions={expenseTransactions}
    />
  );
}
