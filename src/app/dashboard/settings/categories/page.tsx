import type { Metadata } from "next";

import { CategorySettings } from "@/components/category-settings";
import { getExpenseCategories } from "@/lib/expense-categories";

export const metadata: Metadata = { title: "Category settings" };

export default async function CategorySettingsPage() {
  const expenseCategories = await getExpenseCategories();

  return <CategorySettings initialCategories={expenseCategories} />;
}
