import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AutomationEditPageClient } from "@/components/automation-edit-page-client";
import { getBudgetItems } from "@/lib/budget-items";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getExpenseAutomationRules } from "@/lib/expense-automation-rules";
import { getExpenseTags } from "@/lib/expense-tags";

export const metadata: Metadata = {
  title: "Edit automation",
};

export default async function AutomationEditPage({
  params,
}: {
  params: Promise<{ automation_id: string }>;
}) {
  const { automation_id } = await params;
  const automationId = Number(automation_id);
  if (!Number.isInteger(automationId)) {
    notFound();
  }

  const [budgetItems, creditCardTransactions, rules, expenseTags] =
    await Promise.all([
      getBudgetItems(),
      getCreditCardTransactions(),
      getExpenseAutomationRules(),
      getExpenseTags(),
    ]);
  const rule = rules.find((item) => item.id === automationId);
  if (!rule) {
    notFound();
  }

  return (
    <AutomationEditPageClient
      initialBudgetItems={budgetItems}
      initialCreditCardTransactions={creditCardTransactions}
      initialRule={rule}
      initialTags={expenseTags}
    />
  );
}
