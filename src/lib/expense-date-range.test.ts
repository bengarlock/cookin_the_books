import { describe, expect, it } from "vitest";

import {
  defaultExpenseDateRange,
  formatExpenseDateRange,
} from "./expense-date-range";

describe("expense date ranges", () => {
  it("defaults to the previous month through today", () => {
    expect(defaultExpenseDateRange(new Date(2026, 5, 22))).toEqual({
      start: "2026-05-22",
      end: "2026-06-22",
    });
  });

  it("clamps month-end dates", () => {
    expect(defaultExpenseDateRange(new Date(2026, 2, 31))).toEqual({
      start: "2026-02-28",
      end: "2026-03-31",
    });
  });

  it("handles leap years", () => {
    expect(defaultExpenseDateRange(new Date(2024, 2, 31))).toEqual({
      start: "2024-02-29",
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
