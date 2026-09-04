import { describe, expect, it } from "vitest";

import { calendarShowCompletedPreference } from "./calendar-show-completed";

describe("calendar completed-event preference", () => {
  it("defaults to showing completed events", () => {
    expect(calendarShowCompletedPreference(undefined)).toBe(true);
  });

  it("honors either saved user choice", () => {
    expect(calendarShowCompletedPreference(true)).toBe(true);
    expect(calendarShowCompletedPreference(false)).toBe(false);
  });
});
