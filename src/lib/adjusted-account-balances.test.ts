import { describe, expect, it } from "vitest";

import { calculateAdjustedAccountBalances } from "./adjusted-account-balances";
import type { PendingCardTransaction } from "./credit-card-transaction-types";
import type { BankValueSnapshot } from "./snapshot-types";

describe("calculateAdjustedAccountBalances", () => {
  it("adds imported pending charges to the posted Citi balance", () => {
    const result = calculateAdjustedAccountBalances({
      snapshot: {
        citi_current: "664.56",
        citi_pending: "0.00",
      } as BankValueSnapshot,
      pendingTransactions: [],
      pendingCardTransactions: [
        {
          issuer: "Citibank Online",
          account_last_four: "4596",
          amount: "101.25",
          transaction_type: "purchase",
          category: "shopping",
          plaid_category_detailed: "",
          description: "Pending purchase",
          pending: true,
        } satisfies PendingCardTransaction,
      ],
    });

    expect(result.postedValue("citi_current")).toBeCloseTo(664.56, 2);
    expect(result.pendingValue("citi_current")).toBeCloseTo(101.25, 2);
    expect(result.adjustedValue("citi_current")).toBeCloseTo(765.81, 2);
  });
});
