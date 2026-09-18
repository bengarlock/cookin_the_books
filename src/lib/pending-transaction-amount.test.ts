import { describe, expect, it } from "vitest";
import { pendingTransactionAmount } from "./pending-transaction-amount";

describe("pendingTransactionAmount", () => {
  it("encodes the selected direction using the existing signed API contract", () => {
    expect(pendingTransactionAmount("1299.95", "credit")).toBe("-1299.95");
    expect(pendingTransactionAmount("2019.01", "debit")).toBe("2019.01");
  });
  it.each(["", "0", "-25", "NaN", "Infinity", "0.001"])("rejects invalid magnitude %s", (amount) => {
    expect(() => pendingTransactionAmount(amount, "credit")).toThrow("positive amount");
  });
});
