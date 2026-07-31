import type { Metadata } from "next";

import { ReportsDashboard } from "@/components/reports-dashboard";
import { getExpenseCategories } from "@/lib/expense-categories";
import { getTransactionSelectorSummary } from "@/lib/transaction-selector-summary";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const [transactions, categories] = await Promise.all([
    getTransactionSelectorSummary(),
    getExpenseCategories(),
  ]);

  return <ReportsDashboard categories={categories} transactions={transactions} />;
}
