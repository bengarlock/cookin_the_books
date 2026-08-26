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

function addMonths(value: Date, months: number, preferredDay?: number) {
  const monthIndex = value.getMonth() + months;
  const year = value.getFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(preferredDay ?? value.getDate(), lastDay));
}

export function nextFinancialReminderDate(
  reminder: Pick<
    FinancialReminder,
    | "due_date"
    | "recurrence_frequency"
    | "custom_recurrence_type"
    | "custom_recurrence_value"
  >,
  currentDate = localDateFromKey(reminder.due_date),
) {
  switch (reminder.recurrence_frequency) {
    case "none":
      return null;
    case "weekly": {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 7);
      return next;
    }
    case "monthly":
      return addMonths(currentDate, 1);
    case "quarterly":
      return addMonths(currentDate, 3);
    case "yearly":
      return addMonths(currentDate, 12);
    case "custom":
      if (
        reminder.custom_recurrence_type === "interval_days" &&
        reminder.custom_recurrence_value
      ) {
        const next = new Date(currentDate);
        next.setDate(next.getDate() + reminder.custom_recurrence_value);
        return next;
      }
      if (
        reminder.custom_recurrence_type === "month_day" &&
        reminder.custom_recurrence_value
      ) {
        return addMonths(currentDate, 1, reminder.custom_recurrence_value);
      }
      return null;
  }
}

export type CalendarReminderOccurrence = {
  key: string;
  dueDate: string;
  reminder: FinancialReminder;
  projected: boolean;
};

// Sum integer cents so cancellation and zero-total visibility are exact.
export function calendarDayTotalCents(occurrences: CalendarReminderOccurrence[]) {
  return occurrences.reduce((total, { reminder }) => {
    if (reminder.is_completed || !reminder.amount) return total;
    const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(reminder.amount);
    if (!match) return total;
    const cents = BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0"));
    return total + (match[1] === "-" ? -cents : cents);
  }, BigInt(0));
}

export function formatCalendarTotal(cents: bigint) {
  const magnitude = cents < BigInt(0) ? -cents : cents;
  const dollars = (magnitude / BigInt(100)).toLocaleString("en-US");
  const fraction = String(magnitude % BigInt(100)).padStart(2, "0");
  return `${cents < BigInt(0) ? "-" : cents > BigInt(0) ? "+" : ""}$${dollars}.${fraction}`;
}

export function calendarReminderOccurrences(
  reminders: FinancialReminder[],
  rangeStart: string,
  rangeEnd: string,
) {
  const occurrences: CalendarReminderOccurrence[] = [];
  for (const reminder of reminders) {
    if (reminder.due_date >= rangeStart && reminder.due_date <= rangeEnd) {
      occurrences.push({
        key: `reminder-${reminder.id}`,
        dueDate: reminder.due_date,
        reminder,
        projected: false,
      });
    }
    if (reminder.is_completed || reminder.recurrence_frequency === "none") continue;

    let current = localDateFromKey(reminder.due_date);
    for (let index = 0; index < 20_000; index += 1) {
      const next = nextFinancialReminderDate(reminder, current);
      if (!next) break;
      const dueDate = localDateKey(next);
      if (dueDate > rangeEnd) break;
      if (dueDate >= rangeStart) {
        occurrences.push({
          key: `projected-${reminder.id}-${dueDate}`,
          dueDate,
          reminder,
          projected: true,
        });
      }
      current = next;
    }
  }
  return occurrences;
}

export function isHomepageReminderActive(
  reminder: Pick<
    FinancialReminder,
    "due_date" | "homepage_enabled" | "is_enabled" | "is_completed" | "reminder_lead_days"
  >,
  today: Date,
) {
  const dueDate = localDateFromKey(reminder.due_date);
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntilDue = Math.round(
    (dueDate.getTime() - localToday.getTime()) / 86_400_000,
  );
  return (
    reminder.is_enabled !== false &&
    reminder.homepage_enabled &&
    !reminder.is_completed &&
    daysUntilDue >= 0 &&
    daysUntilDue <= reminder.reminder_lead_days
  );
}
