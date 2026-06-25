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
      <section className="border-b border-white/10 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
          Budget
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Income
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          Track pay statements, gross income, net income, and withholdings over
          time.
        </p>
        <BudgetNavigation />
      </section>

      <IncomeHistory initialEntries={incomeEntries} />
    </div>
  );
}
