import type { Metadata } from "next";

import { FinancialGoals } from "@/components/financial-goals";
import { getFinancialGoals } from "@/lib/financial-goals";

export const metadata: Metadata = { title: "Financial Goals" };

export default async function GoalsPage() {
  const goals = await getFinancialGoals();

  return <FinancialGoals initialGoals={goals} />;
}
