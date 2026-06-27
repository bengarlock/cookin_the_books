import { describe, expect, it } from "vitest";

import {
  extractApiErrorDetail,
  extractApiErrorMessage,
} from "./api-error-message";

describe("extractApiErrorMessage", () => {
  it("prefers message over detail", () => {
    expect(
      extractApiErrorMessage(
        { message: "Friendly message", detail: "Raw detail" },
        "fallback",
      ),
    ).toBe("Friendly message");
  });

  it("uses detail when message is missing", () => {
    expect(
      extractApiErrorMessage(
        { detail: "Invalid keyword argument for ExpenseEntry" },
        "fallback",
      ),
    ).toBe("Invalid keyword argument for ExpenseEntry");
  });

  it("reads the first field validation error", () => {
    expect(
      extractApiErrorMessage(
        { match_value: ["This field may not be blank."] },
        "fallback",
      ),
    ).toBe("match_value: This field may not be blank.");
  });

  it("falls back when payload is empty", () => {
    expect(extractApiErrorMessage(null, "fallback")).toBe("fallback");
  });
});

describe("extractApiErrorDetail", () => {
  it("returns detail when it differs from message", () => {
    expect(
      extractApiErrorDetail({
        message: "Expense automation run failed: boom",
        detail: "boom",
      }),
    ).toBe("boom");
  });

  it("returns null when detail matches message", () => {
    expect(
      extractApiErrorDetail({
        message: "boom",
        detail: "boom",
      }),
    ).toBeNull();
  });
});
