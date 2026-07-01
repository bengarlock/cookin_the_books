import type { Metadata } from "next";

import { BudgetNavigation } from "@/components/budget-navigation";
import { FinancialGoals } from "@/components/financial-goals";
import { getFinancialGoals } from "@/lib/financial-goals";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";

export const metadata: Metadata = { title: "Financial Goals" };

export default async function GoalsPage() {
  const [goals, settings] = await Promise.all([
    getFinancialGoals(),
    getBudgetPlanSettings(),
  ]);
  return (
    <div className="w-full">
      <section className="border-b border-white/10 pb-6"><BudgetNavigation /></section>
      <FinancialGoals
        initialGoals={goals}
        nextPaydayOverride={settings.next_payday_override}
      />
    </div>
  );
}
