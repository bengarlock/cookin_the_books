import { describe, expect, it } from "vitest";

import {
  isHomepageReminderActive,
  localDateKey,
  monthCalendarDays,
} from "./financial-reminder-dates";

describe("financial reminder dates", () => {
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
      is_completed: false,
      reminder_lead_days: 30,
    };
    expect(isHomepageReminderActive(reminder, new Date(2026, 9, 12))).toBe(true);
    expect(isHomepageReminderActive(reminder, new Date(2026, 9, 11))).toBe(false);
    expect(isHomepageReminderActive(reminder, new Date(2026, 10, 12))).toBe(false);
  });
});
