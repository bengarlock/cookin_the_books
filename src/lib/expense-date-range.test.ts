import { describe, expect, it } from "vitest";

import {
  defaultExpenseDateRange,
  formatExpenseDateRange,
} from "./expense-date-range";

describe("expense date ranges", () => {
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
});
