import { describe, expect, it } from "vitest";

import type { CreditCardTransaction } from "./credit-card-transaction-types";
import { accountTransactionDisplayAmount } from "./account-transaction-display";

function transaction(
  overrides: Partial<CreditCardTransaction> = {},
): CreditCardTransaction {
  return {
    amount: "25.00",
    transaction_type: "purchase",
    ...overrides,
  } as CreditCardTransaction;
}

describe("accountTransactionDisplayAmount", () => {
  it("keeps credit card liability signs", () => {
    expect(
      accountTransactionDisplayAmount(
        transaction({ transaction_type: "purchase" }),
        "chase_credit",
      ),
    ).toBe(25);
    expect(
      accountTransactionDisplayAmount(
        transaction({ transaction_type: "credit" }),
        "chase_credit",
      ),
    ).toBe(-25);
  });

  it("shows checking and savings credits as inflows and expenses as outflows", () => {
    expect(
      accountTransactionDisplayAmount(
        transaction({ transaction_type: "credit" }),
        "chase_checking",
      ),
    ).toBe(25);
    expect(
      accountTransactionDisplayAmount(
        transaction({ transaction_type: "purchase" }),
        "chase_savings",
      ),
    ).toBe(-25);
  });

  it("returns null for invalid amounts", () => {
    expect(
      accountTransactionDisplayAmount(
        transaction({ amount: "not-a-number" }),
        "chase_checking",
      ),
    ).toBeNull();
  });
});
