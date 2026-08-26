import type { ReactNode } from "react";

import { BudgetDateRangePicker } from "@/components/budget-date-range-picker";
import { BudgetNavigation } from "@/components/budget-navigation";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";

export default async function BudgetLayout({
  children,
}: {
  children: ReactNode;
}) {
  const budgetPlanSettings = await getBudgetPlanSettings();

  return (
    <div className="w-full">
      <section className="mb-6">
        <BudgetNavigation />
      </section>
      <BudgetDateRangePicker
        nextPaydayOverride={budgetPlanSettings.next_payday_override}
      />
      {children}
    </div>
  );
}
