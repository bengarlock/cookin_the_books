import type { Metadata } from "next";

import { ExpenseHistory } from "@/components/expense-history";
import { getBudgetItems } from "@/lib/budget-items";
import { getExpenseCategories } from "@/lib/expense-categories";
import {
  allTimeExpenseDateRange,
  expenseDateRangeFromSearchParams,
} from "@/lib/expense-date-range";
import { getExpenseEntries } from "@/lib/expense-entries";
import { getExpenseTags } from "@/lib/expense-tags";
import {
  getExpenseTransactionMetadata,
  getExpenseTransactions,
} from "@/lib/expense-transactions";

export const metadata: Metadata = {
  title: "Expenses",
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string | string[]; end?: string | string[] }>;
}) {
  const initialRange = expenseDateRangeFromSearchParams(await searchParams);
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
    getExpenseTransactions(allTimeExpenseDateRange()),
    getExpenseTransactionMetadata(),
  ]);

  return (
    <ExpenseHistory
      initialAllTransactionsLoaded
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
