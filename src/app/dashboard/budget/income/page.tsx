import type { Metadata } from "next";

import { IncomeHistory } from "@/components/income-history";
import { getIncomeEntries } from "@/lib/income-entries";
import { getIncomeTransactions } from "@/lib/income-transactions";
import { expenseDateRangeFromSearchParams } from "@/lib/expense-date-range";

export const metadata: Metadata = {
  title: "Income",
};

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string | string[]; end?: string | string[] }>;
}) {
  const initialRange = expenseDateRangeFromSearchParams(await searchParams);
  const [incomeEntries, incomeTransactions] = await Promise.all([
    getIncomeEntries(),
    getIncomeTransactions(),
  ]);

  return (
    <IncomeHistory
      initialIncomeEntries={incomeEntries}
      initialIncomeTransactions={incomeTransactions}
      initialRange={initialRange}
    />
  );
}
