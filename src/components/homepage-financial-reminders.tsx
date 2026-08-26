import Link from "next/link";

import { localDateFromKey } from "@/lib/financial-reminder-dates";
import type { FinancialReminder } from "@/lib/financial-reminder-types";

function dueLabel(reminder: FinancialReminder) {
  if (reminder.days_until_due === 0) return "Due today";
  if (reminder.days_until_due === 1) return "Due tomorrow";
  return `Due in ${reminder.days_until_due} days`;
}

export function HomepageFinancialReminders({
  reminders,
}: {
  reminders: FinancialReminder[];
}) {
  const active = reminders
    .filter((reminder) => reminder.is_enabled !== false && reminder.active_on_homepage)
    .sort((left, right) => left.due_date.localeCompare(right.due_date));
  if (!active.length) return null;

  return (
    <section className="surface mb-6 overflow-hidden rounded-2xl border-amber-300/20 bg-amber-300/[0.055]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300/15 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200/80">
            Financial Calendar
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            {active.length === 1
              ? "One event is coming up"
              : `${active.length} events are coming up`}
          </h2>
        </div>
        <Link
          href="/dashboard/calendar"
          className="rounded-xl border border-amber-200/20 px-3 py-2 text-sm font-medium text-amber-100 transition hover:border-amber-200/40 hover:bg-amber-200/10"
        >
          Open Calendar
        </Link>
      </div>
      <div className="divide-y divide-white/[0.07]">
        {active.slice(0, 4).map((reminder) => (
          <Link
            href="/dashboard/calendar"
            key={reminder.id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-white/[0.035]"
          >
            <span>
              <span className="block text-sm font-semibold text-white">
                {reminder.title}
              </span>
              <span className="mt-0.5 block text-xs text-white/50">
                {dueLabel(reminder)} ·{" "}
                {new Intl.DateTimeFormat("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }).format(localDateFromKey(reminder.due_date))}
              </span>
            </span>
            {reminder.amount ? (
              <span className="text-base font-semibold text-amber-100">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(Number(reminder.amount))}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
