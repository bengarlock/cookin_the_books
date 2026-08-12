import type { Metadata } from "next";

import { ExpenseHistory } from "@/components/expense-history";
import { getExpenseCategories } from "@/lib/expense-categories";
import {
  allTimeExpenseDateRange,
  expenseDateRangeFromSearchParams,
} from "@/lib/expense-date-range";
import { getExpenseTags } from "@/lib/expense-tags";
import { getExpenseTransactions } from "@/lib/expense-transactions";

export const metadata: Metadata = {
  title: "Expenses",
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string | string[]; end?: string | string[] }>;
}) {
  const initialRange = expenseDateRangeFromSearchParams(await searchParams);
  const [expenseCategories, expenseTags, expenseTransactions] = await Promise.all([
    getExpenseCategories(),
    getExpenseTags(),
    getExpenseTransactions(allTimeExpenseDateRange()),
  ]);

  return (
    <ExpenseHistory
      initialCategories={expenseCategories}
      initialRange={initialRange}
      initialTags={expenseTags}
      initialTransactions={expenseTransactions}
    />
  );
}
