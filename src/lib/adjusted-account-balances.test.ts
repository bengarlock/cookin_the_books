import { describe, expect, it } from "vitest";

import { calculateAdjustedAccountBalances } from "./adjusted-account-balances";
import type { PendingCardTransaction } from "./credit-card-transaction-types";
import type { PendingTransaction } from "./pending-transaction-types";
import type { BankValueSnapshot } from "./snapshot-types";

function pending(overrides: Partial<PendingTransaction>): PendingTransaction {
  return {
    id: 1, account: "chase_checking", note: "", amount: "0", settled_accounts: [],
    expected_post_date: "2026-07-01", is_cleared: false, cleared_at: null,
    matched_transaction: null, matched_transaction_detail: null, match_status: "none",
    match_confidence: null, match_method: "", matched_at: null,
    created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("calculateAdjustedAccountBalances", () => {
  it("nets a cash credit against an existing debit and excludes cleared credits", () => {
    const result = calculateAdjustedAccountBalances({
      snapshot: { chase_checking: "1219.06" } as BankValueSnapshot,
      pendingTransactions: [
        { amount: "2019.01", is_cleared: false },
        { amount: "-1299.95", is_cleared: false },
        { amount: "-500.00", is_cleared: true },
      ].map((transaction) => pending(transaction)),
      pendingCardTransactions: [],
    });
    expect(result.pendingValue("chase_checking")).toBeCloseTo(719.06, 2);
    expect(result.adjustedValue("chase_checking")).toBeCloseTo(500, 2);
  });

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

  it("subtracts a manual statement credit from a credit card liability", () => {
    const result = calculateAdjustedAccountBalances({
      snapshot: {
        chase_credit: "200.00",
      } as BankValueSnapshot,
      pendingTransactions: [
        pending({
          account: "chase_credit",
          amount: "-25.50",
          is_cleared: false,
          match_status: "none",
          settled_accounts: [],
        }),
      ],
      pendingCardTransactions: [],
    });

    expect(result.pendingValue("chase_credit")).toBeCloseTo(-25.5, 2);
    expect(result.adjustedValue("chase_credit")).toBeCloseTo(174.5, 2);
  });
});
