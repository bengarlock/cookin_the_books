import { describe, expect, it } from "vitest";

import {
  allTimeExpenseDateRange,
  defaultExpenseDateRange,
  expenseDateRangePreset,
  formatExpenseDateRange,
  mergeExpenseDateRange,
} from "./expense-date-range";

describe("expense date ranges", () => {
  it("creates an all-time range with a universal or caller-provided start", () => {
    const currentDate = new Date(2026, 6, 12);

    expect(allTimeExpenseDateRange(currentDate)).toEqual({
      start: "1900-01-01",
      end: "2026-07-12",
    });
    expect(allTimeExpenseDateRange(currentDate, "2024-03-15")).toEqual({
      start: "2024-03-15",
      end: "2026-07-12",
    });
  });
  it("defaults to the current year through today", () => {
    expect(defaultExpenseDateRange(new Date(2026, 5, 22))).toEqual({
      start: "2026-01-01",
      end: "2026-06-22",
    });
  });

  it("handles a month-end date", () => {
    expect(defaultExpenseDateRange(new Date(2026, 2, 31))).toEqual({
      start: "2026-01-01",
      end: "2026-03-31",
    });
  });

  it("handles leap years", () => {
    expect(defaultExpenseDateRange(new Date(2024, 2, 31))).toEqual({
      start: "2024-01-01",
      end: "2024-03-31",
    });
  });

  it("formats a readable range", () => {
    expect(
      formatExpenseDateRange({
        start: "2026-05-22",
        end: "2026-06-22",
      }),
    ).toBe("May 22, 2026 – Jun 22, 2026");
  });

  it("creates a rolling seven-day week preset", () => {
    expect(
      expenseDateRangePreset("week", new Date(2026, 5, 23)),
    ).toEqual({
      start: "2026-06-17",
      end: "2026-06-23",
    });
  });

  it("creates a month-to-date preset", () => {
    expect(
      expenseDateRangePreset("month", new Date(2026, 5, 23)),
    ).toEqual({
      start: "2026-06-01",
      end: "2026-06-23",
    });
  });

  it("creates a year-to-date preset", () => {
    expect(expenseDateRangePreset("ytd", new Date(2026, 5, 23))).toEqual({
      start: "2026-01-01",
      end: "2026-06-23",
    });
  });

  it("expands the selected range to include imported statement dates", () => {
    expect(
      mergeExpenseDateRange(
        { start: "2026-01-01", end: "2026-06-27" },
        { start: "2025-08-04", end: "2025-09-02" },
      ),
    ).toEqual({
      start: "2025-08-04",
      end: "2026-06-27",
    });
  });
});
