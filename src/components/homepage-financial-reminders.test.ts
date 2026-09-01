import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomepageFinancialReminders } from "./homepage-financial-reminders";
import type { FinancialReminder } from "../lib/financial-reminder-types";

function reminder(
  overrides: Partial<FinancialReminder> = {},
): FinancialReminder {
  return {
    id: 42,
    title: "Bill Medical Insurance",
    amount: "164.76",
    due_date: "2026-08-01",
    notes: "",
    reminder_lead_days: 1,
    reminder_cadence: "once",
    recurrence_frequency: "monthly",
    custom_recurrence_type: null,
    custom_recurrence_value: null,
    email_enabled: true,
    homepage_enabled: true,
    is_enabled: true,
    is_completed: false,
    completed_at: null,
    active_on_homepage: true,
    days_until_due: -31,
    notification_due_date: "2026-09-01",
    notification_days_until_due: 0,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("homepage financial reminders", () => {
  it("renders the active recurring occurrence instead of its overdue series origin", () => {
    const html = renderToStaticMarkup(
      createElement(HomepageFinancialReminders, { reminders: [reminder()] }),
    );

    expect(html).toContain("Bill Medical Insurance");
    expect(html).toContain("Due today");
    expect(html).toContain("September 1, 2026");
    expect(html).toContain("/dashboard/calendar?reminder=42");
    expect(html).not.toContain("August 1, 2026");
  });

  it("stays hidden when no reminder is active", () => {
    expect(
      renderToStaticMarkup(
        createElement(HomepageFinancialReminders, {
          reminders: [reminder({ active_on_homepage: false })],
        }),
      ),
    ).toBe("");
  });
});
