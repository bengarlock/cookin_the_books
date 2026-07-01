import { describe, expect, it } from "vitest";

import { normalizeCurrencyInput, normalizeDateInput } from "./form-input-normalization";

describe("form input normalization", () => {
  it("accepts pasted formatted currency", () => {
    expect(normalizeCurrencyInput("$1,541.00")).toBe("1541.00");
  });

  it("accepts common pasted dates", () => {
    expect(normalizeDateInput("08/15/2026")).toBe("2026-08-15");
    expect(normalizeDateInput("2026-08-15")).toBe("2026-08-15");
  });

  it("rejects impossible dates", () => {
    expect(normalizeDateInput("02/30/2026")).toBeNull();
  });
});
