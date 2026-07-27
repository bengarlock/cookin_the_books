import type { Metadata } from "next";

import { ReportsDashboard } from "@/components/reports-dashboard";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getExpenseCategories } from "@/lib/expense-categories";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const [transactions, categories] = await Promise.all([
    getCreditCardTransactions(),
    getExpenseCategories(),
  ]);

  return <ReportsDashboard categories={categories} transactions={transactions} />;
}
