import type { Metadata } from "next";

import { FinancialCalendar } from "@/components/financial-calendar";
import { getFinancialReminders } from "@/lib/financial-reminders";

export const metadata: Metadata = {
  title: "Calendar",
};

export default async function CalendarPage() {
  const reminders = await getFinancialReminders();
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
      <FinancialCalendar initialReminders={reminders} />
    </div>
  );
}
