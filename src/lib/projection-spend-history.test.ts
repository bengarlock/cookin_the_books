import { describe, expect, it } from "vitest";

import { projectionSpendHistoryDateRange } from "./projection-spend-history";

describe("projectionSpendHistoryDateRange", () => {
  const currentDate = new Date(2026, 5, 27);

  it("returns inclusive rolling history windows", () => {
    expect(projectionSpendHistoryDateRange("last_30_days", currentDate)).toEqual({
      start: "2026-05-29",
      end: "2026-06-27",
    });
    expect(projectionSpendHistoryDateRange("last_90_days", currentDate)).toEqual({
      start: "2026-03-30",
      end: "2026-06-27",
    });
  });

  it("returns calendar-aligned year-to-date and all-history windows", () => {
    expect(projectionSpendHistoryDateRange("year_to_date", currentDate)).toEqual({
      start: "2026-01-01",
      end: "2026-06-27",
    });
    expect(projectionSpendHistoryDateRange("all_history", currentDate)).toEqual({
      start: "1900-01-01",
      end: "2026-06-27",
    });
  });
});
