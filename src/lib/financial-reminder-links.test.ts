import { describe, expect, it } from "vitest";

import { parseFinancialReminderId } from "./financial-reminder-links";

describe("financial reminder links", () => {
  it("parses a positive reminder id", () => {
    expect(parseFinancialReminderId("42")).toBe(42);
  });

  it("rejects missing, repeated, or malformed reminder ids", () => {
    expect(parseFinancialReminderId(undefined)).toBeNull();
    expect(parseFinancialReminderId(["42", "43"])).toBeNull();
    expect(parseFinancialReminderId("0")).toBeNull();
    expect(parseFinancialReminderId("-1")).toBeNull();
    expect(parseFinancialReminderId("4.2")).toBeNull();
    expect(parseFinancialReminderId("not-a-number")).toBeNull();
    expect(parseFinancialReminderId("9007199254740992")).toBeNull();
  });
});
