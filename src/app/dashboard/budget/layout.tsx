import { Suspense, type ReactNode } from "react";

import { BudgetDateRangePicker } from "@/components/budget-date-range-picker";
import { BudgetLoading } from "@/components/budget-loading";
import { BudgetNavigation } from "@/components/budget-navigation";

export default function BudgetLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="w-full">
      <section className="mb-6">
        <BudgetNavigation />
      </section>
      <BudgetDateRangePicker />
      <Suspense fallback={<BudgetLoading />}>{children}</Suspense>
    </div>
  );
}
