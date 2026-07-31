import type { Metadata } from "next";

import { IncomeHistory } from "@/components/income-history";
import { getIncomeEntries } from "@/lib/income-entries";
import { getIncomeTransactions } from "@/lib/income-transactions";

export const metadata: Metadata = {
  title: "Income",
};

export default async function IncomePage() {
  const [incomeEntries, incomeTransactions] = await Promise.all([
    getIncomeEntries(),
    getIncomeTransactions(),
  ]);

  return (
    <IncomeHistory
      initialIncomeEntries={incomeEntries}
      initialIncomeTransactions={incomeTransactions}
    />
  );
}
