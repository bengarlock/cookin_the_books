import { describe, expect, it } from "vitest";

import {
  isValidCurrencyInput,
  normalizeCurrencyInput,
  normalizeDateInput,
} from "./form-input-normalization";

describe("form input normalization", () => {
  it("accepts pasted formatted currency", () => {
    expect(normalizeCurrencyInput("$1,541.00")).toBe("1541.00");
  });

  it("accepts currency input with no more than two decimal places", () => {
    expect(isValidCurrencyInput("")).toBe(true);
    expect(isValidCurrencyInput("1000")).toBe(true);
    expect(isValidCurrencyInput("1000.")).toBe(true);
    expect(isValidCurrencyInput("1000.0")).toBe(true);
    expect(isValidCurrencyInput("1000.00")).toBe(true);
    expect(isValidCurrencyInput("$1,000.00")).toBe(true);
  });

  it("rejects currency input with more than two decimal places", () => {
    expect(isValidCurrencyInput("1000.000")).toBe(false);
    expect(isValidCurrencyInput("1000.00000")).toBe(false);
    expect(isValidCurrencyInput("1.2.3")).toBe(false);
  });

  it("accepts common pasted dates", () => {
    expect(normalizeDateInput("08/15/2026")).toBe("2026-08-15");
    expect(normalizeDateInput("2026-08-15")).toBe("2026-08-15");
  });

  it("rejects impossible dates", () => {
    expect(normalizeDateInput("02/30/2026")).toBeNull();
  });
});
