import { describe, expect, it } from "vitest";

import { formatReceiptItemAmount } from "./receipt-order-details";

describe("formatReceiptItemAmount", () => {
  it("does not render missing receipt amounts as zero", () => {
    expect(formatReceiptItemAmount(null)).toBe("—");
    expect(formatReceiptItemAmount(undefined)).toBe("—");
    expect(formatReceiptItemAmount("")).toBe("—");
  });

  it("formats captured receipt amounts", () => {
    expect(formatReceiptItemAmount("25.00")).toBe("$25.00");
  });
});
