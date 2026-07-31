import type { Metadata } from "next";

import { ExpenseHistory } from "@/components/expense-history";
import { getExpenseTags } from "@/lib/expense-tags";

export const metadata: Metadata = {
  title: "Expenses",
};

export default async function ExpensesPage() {
  const expenseTags = await getExpenseTags();

  return <ExpenseHistory initialTags={expenseTags} />;
}
