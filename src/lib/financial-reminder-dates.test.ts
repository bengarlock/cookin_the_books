import { describe, expect, it } from "vitest";

import {
  calendarReminderOccurrences,
  calendarDayTotalCents,
  formatCalendarTotal,
  isHomepageReminderActive,
  localDateKey,
  monthCalendarDays,
  nextFinancialReminderDate,
} from "./financial-reminder-dates";
import type { FinancialReminder } from "./financial-reminder-types";

function reminder(
  overrides: Partial<FinancialReminder> = {},
): FinancialReminder {
  return {
    id: 1,
    title: "Hulu",
    amount: "20.25",
    due_date: "2026-09-13",
    notes: "",
    reminder_lead_days: 7,
    reminder_cadence: "once",
    recurrence_frequency: "monthly",
    custom_recurrence_type: null,
    custom_recurrence_value: null,
    email_enabled: true,
    homepage_enabled: true,
    is_enabled: true,
    is_completed: false,
    completed_at: null,
    active_on_homepage: false,
    days_until_due: 20,
    created_at: "2026-08-24T00:00:00Z",
    updated_at: "2026-08-24T00:00:00Z",
    ...overrides,
  };
}

describe("financial reminder dates", () => {
  it("nets daily costs and payments without rounding errors or completed entries", () => {
    const occurrences = calendarReminderOccurrences([
      reminder({ id: 1, amount: "-0.10" }),
      reminder({ id: 2, amount: "-0.20" }),
      reminder({ id: 3, amount: "0.30" }),
      reminder({ id: 4, amount: null }),
      reminder({ id: 5, amount: "-900.00", is_completed: true }),
    ], "2026-09-13", "2026-09-13");
    expect(calendarDayTotalCents(occurrences)).toBe(BigInt(0));
    expect(calendarDayTotalCents([])).toBe(BigInt(0));
    expect(calendarDayTotalCents(occurrences.slice(0, 2))).toBe(BigInt(-30));
  });

  it("includes projections and recalculates their dates after moving a saved entry", () => {
    const moved = reminder({ amount: "-25.50", due_date: "2026-09-20" });
    const occurrences = calendarReminderOccurrences([moved], "2026-09-01", "2026-10-31");
    expect(occurrences.map((item) => item.dueDate)).toEqual(["2026-09-20", "2026-10-20"]);
    expect(calendarDayTotalCents(occurrences.filter((item) => item.projected))).toBe(BigInt(-2550));
  });

  it("formats signed daily totals exactly even above JavaScript's safe integer limit", () => {
    expect(formatCalendarTotal(BigInt(-125050))).toBe("-$1,250.50");
    expect(formatCalendarTotal(BigInt(125050))).toBe("+$1,250.50");
    expect(formatCalendarTotal(BigInt(0))).toBe("$0.00");
    expect(formatCalendarTotal(BigInt("999999999999999999"))).toBe("+$9,999,999,999,999,999.99");
  });

  it("builds a stable six-week month grid", () => {
    const days = monthCalendarDays(new Date(2026, 10, 1));
    expect(days).toHaveLength(42);
    expect(days[0].dateKey).toBe("2026-11-01");
    expect(days[41].dateKey).toBe("2026-12-12");
  });

  it("formats local dates without a UTC day shift", () => {
    expect(localDateKey(new Date(2026, 10, 11))).toBe("2026-11-11");
  });

  it("activates homepage reminders throughout their lead window", () => {
    const reminder = {
      due_date: "2026-11-11",
      homepage_enabled: true,
      is_enabled: true,
      is_completed: false,
      reminder_lead_days: 30,
    };
    expect(isHomepageReminderActive(reminder, new Date(2026, 9, 12))).toBe(true);
    expect(isHomepageReminderActive(reminder, new Date(2026, 9, 11))).toBe(false);
    expect(isHomepageReminderActive(reminder, new Date(2026, 10, 12))).toBe(false);
  });

  it("pauses homepage alerts without removing disabled payments or projections", () => {
    const disabled = reminder({ is_enabled: false, amount: "-25.50" });
    expect(isHomepageReminderActive(disabled, new Date(2026, 8, 13))).toBe(false);
    expect(isHomepageReminderActive({ ...disabled, is_enabled: true }, new Date(2026, 8, 13))).toBe(true);
    const occurrences = calendarReminderOccurrences([disabled], "2026-09-01", "2026-10-31");
    expect(occurrences.map((item) => item.dueDate)).toEqual(["2026-09-13", "2026-10-13"]);
    expect(calendarDayTotalCents(occurrences)).toBe(BigInt(-5100));
  });

  it("projects monthly reminders into future calendar months", () => {
    const occurrences = calendarReminderOccurrences(
      [reminder()],
      "2026-10-01",
      "2026-10-31",
    );
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatchObject({
      dueDate: "2026-10-13",
      projected: true,
    });
  });

  it("does not project completed reminders", () => {
    expect(
      calendarReminderOccurrences(
        [reminder({ is_completed: true })],
        "2026-10-01",
        "2026-10-31",
      ),
    ).toEqual([]);
  });

  it("supports custom intervals in days", () => {
    const next = nextFinancialReminderDate(
      reminder({
        due_date: "2026-09-13",
        recurrence_frequency: "custom",
        custom_recurrence_type: "interval_days",
        custom_recurrence_value: 10,
      }),
    );
    expect(next && localDateKey(next)).toBe("2026-09-23");
  });

  it("supports a custom day of the month and clamps short months", () => {
    const next = nextFinancialReminderDate(
      reminder({
        due_date: "2027-01-15",
        recurrence_frequency: "custom",
        custom_recurrence_type: "month_day",
        custom_recurrence_value: 31,
      }),
    );
    expect(next && localDateKey(next)).toBe("2027-02-28");
  });
});
