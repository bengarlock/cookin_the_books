import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AutomationRuleEditor } from "@/components/automation-rule-editor";
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
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Automation
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            {rule.name}
          </h1>
        </div>
        <Link
          className="self-start rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:border-accent/25 hover:bg-accent/10 sm:self-auto"
          href="/dashboard/automations"
        >
          Back to automations
        </Link>
      </div>

      <AutomationRuleEditor
        cancelHref="/dashboard/automations"
        initialBudgetItems={budgetItems}
        initialCreditCardTransactions={creditCardTransactions}
        initialRule={rule}
        initialTags={expenseTags}
      />
    </div>
  );
}
