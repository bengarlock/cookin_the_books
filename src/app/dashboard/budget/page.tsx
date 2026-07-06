import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { RecurringExpenses } from "@/components/recurring-expenses";

export const metadata: Metadata = {
  title: "Budget",
};

export default function BudgetPage() {
  return (
    <>
      <LiveBankValues view="budget" />
      <RecurringExpenses />
    </>
  );
}
