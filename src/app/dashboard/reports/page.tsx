import type { Metadata } from "next";

import { ReportsDashboard } from "@/components/reports-dashboard";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  return <ReportsDashboard transactions={await getCreditCardTransactions()} />;
}
