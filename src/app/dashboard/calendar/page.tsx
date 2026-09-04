import type { Metadata } from "next";

import { FinancialCalendar } from "@/components/financial-calendar";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { calendarShowCompletedPreference } from "@/lib/calendar-show-completed";
import { allTimeExpenseDateRange } from "@/lib/expense-date-range";
import { getExpenseTransactions } from "@/lib/expense-transactions";
import { financialCalendarActivities } from "@/lib/financial-calendar-activity";
import {
  buildRecurringExpenseSuggestions,
  recurringExpenseSuggestionRange,
} from "@/lib/financial-reminder-suggestions";
import { parseFinancialReminderId } from "@/lib/financial-reminder-links";
import { getFinancialReminders } from "@/lib/financial-reminders";
import { getIncomeEntries } from "@/lib/income-entries";
import { getIncomeTransactions } from "@/lib/income-transactions";

export const metadata: Metadata = {
  title: "Financial Calendar",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ reminder?: string | string[] }>;
}) {
  const { reminder } = await searchParams;
  const suggestionRange = recurringExpenseSuggestionRange();
  const [
    reminders,
    historicalExpenseTransactions,
    incomeTransactions,
    incomeEntries,
    settings,
  ] = await Promise.all([
    getFinancialReminders(),
    getExpenseTransactions(allTimeExpenseDateRange()),
    getIncomeTransactions(),
    getIncomeEntries(),
    getBudgetPlanSettings(),
  ]);
  const suggestionTransactions = historicalExpenseTransactions.filter(
    (transaction) =>
      transaction.transaction_date >= suggestionRange.start &&
      transaction.transaction_date <= suggestionRange.end,
  );
  const dismissedSuggestionIds =
    settings.dismissed_financial_reminder_suggestions ?? [];
  const dismissedSuggestions = new Set(dismissedSuggestionIds);
  const suggestions = buildRecurringExpenseSuggestions(
    suggestionTransactions,
    reminders,
    suggestionRange.end,
  ).filter((suggestion) => !dismissedSuggestions.has(suggestion.id));
  return (
    <div className="w-full">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Calendar
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Financial Calendar</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
          Track financial events, payments, and incoming funds in one place, with optional reminders.
        </p>
      </header>
      <FinancialCalendar
        initialHistoricalActivity={financialCalendarActivities(
          historicalExpenseTransactions,
          incomeTransactions,
          incomeEntries,
        )}
        initialReminders={reminders}
        initialSelectedId={parseFinancialReminderId(reminder)}
        initialSuggestions={suggestions}
        initialDismissedSuggestionIds={dismissedSuggestionIds}
        initialShowCompleted={calendarShowCompletedPreference(
          settings.navigation_preferences?.calendar_show_completed,
        )}
      />
    </div>
  );
}
