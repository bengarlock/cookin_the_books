import type { Metadata } from "next";

import { BudgetNavigation } from "@/components/budget-navigation";
import { IncomeHistory } from "@/components/income-history";
import { getIncomeEntries } from "@/lib/income-entries";

export const metadata: Metadata = {
  title: "Income",
};

export default async function IncomePage() {
  const incomeEntries = await getIncomeEntries();

  return (
    <div className="w-full">
      <section className="border-b border-white/10 pb-6">
        <BudgetNavigation />
      </section>

      <IncomeHistory initialEntries={incomeEntries} />
    </div>
  );
}
