import type { Metadata } from "next";

import { BudgetNavigation } from "@/components/budget-navigation";
import { ProjectionsDashboard } from "@/components/projections-dashboard";
import { getIncomeEntries } from "@/lib/income-entries";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Projections",
};

export default async function ProjectionsPage() {
  const [incomeEntries, pendingTransactions] = await Promise.all([
    getIncomeEntries(),
    getPendingTransactions(),
  ]);

  return (
    <div className="w-full">
      <section className="border-b border-white/10 pb-6">
        <BudgetNavigation />
      </section>

      <ProjectionsDashboard
        initialIncomeEntries={incomeEntries}
        initialPendingTransactions={pendingTransactions}
      />
    </div>
  );
}
