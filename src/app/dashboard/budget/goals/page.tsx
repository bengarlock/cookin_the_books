import type { Metadata } from "next";

import { BudgetNavigation } from "@/components/budget-navigation";
import { FinancialGoals } from "@/components/financial-goals";
import { getFinancialGoals } from "@/lib/financial-goals";

export const metadata: Metadata = { title: "Financial Goals" };

export default async function GoalsPage() {
  const goals = await getFinancialGoals();
  return (
    <div className="w-full">
      <section className="border-b border-white/10 pb-6"><BudgetNavigation /></section>
      <FinancialGoals initialGoals={goals} />
    </div>
  );
}
