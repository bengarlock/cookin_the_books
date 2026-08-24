import type { Metadata } from "next";

import { FinancialCalendar } from "@/components/financial-calendar";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { getExpenseTransactions } from "@/lib/expense-transactions";
import {
  buildRecurringExpenseSuggestions,
  recurringExpenseSuggestionRange,
} from "@/lib/financial-reminder-suggestions";
import { parseFinancialReminderId } from "@/lib/financial-reminder-links";
import { getFinancialReminders } from "@/lib/financial-reminders";

export const metadata: Metadata = {
  title: "Calendar",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ reminder?: string | string[] }>;
}) {
  const { reminder } = await searchParams;
  const suggestionRange = recurringExpenseSuggestionRange();
  const [reminders, expenseTransactions, settings] = await Promise.all([
    getFinancialReminders(),
    getExpenseTransactions(suggestionRange),
    getBudgetPlanSettings(),
  ]);
  const dismissedSuggestionIds =
    settings.dismissed_financial_reminder_suggestions ?? [];
  const dismissedSuggestions = new Set(dismissedSuggestionIds);
  const suggestions = buildRecurringExpenseSuggestions(
    expenseTransactions,
    reminders,
    suggestionRange.end,
  ).filter((suggestion) => !dismissedSuggestions.has(suggestion.id));
  return (
    <div className="w-full">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Calendar
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Financial reminders</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
          Keep due dates, payment amounts, and the reminders you need in one place.
        </p>
      </header>
      <FinancialCalendar
        initialReminders={reminders}
        initialSelectedId={parseFinancialReminderId(reminder)}
        initialSuggestions={suggestions}
        initialDismissedSuggestionIds={dismissedSuggestionIds}
      />
    </div>
  );
}
