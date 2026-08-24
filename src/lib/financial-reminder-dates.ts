import type { FinancialReminder } from "./financial-reminder-types";

export type CalendarDay = {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
};

export function localDateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthCalendarDays(month: Date): CalendarDay[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      dateKey: localDateKey(date),
      isCurrentMonth: date.getMonth() === month.getMonth(),
    };
  });
}

export function isHomepageReminderActive(
  reminder: Pick<
    FinancialReminder,
    "due_date" | "homepage_enabled" | "is_completed" | "reminder_lead_days"
  >,
  today: Date,
) {
  const dueDate = localDateFromKey(reminder.due_date);
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntilDue = Math.round(
    (dueDate.getTime() - localToday.getTime()) / 86_400_000,
  );
  return (
    reminder.homepage_enabled &&
    !reminder.is_completed &&
    daysUntilDue >= 0 &&
    daysUntilDue <= reminder.reminder_lead_days
  );
}
