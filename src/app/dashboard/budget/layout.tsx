import type { ReactNode } from "react";

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
      {children}
    </div>
  );
}
