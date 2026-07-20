import { describe, expect, it } from "vitest";

import type { PendingCardTransaction } from "./credit-card-transaction-types";
import {
  accountKeyForTransaction,
  importedPendingLiabilityTotals,
  transactionsForAccount,
} from "./account-transaction-filters";

function cardTransaction(
  overrides: Partial<PendingCardTransaction> = {},
): PendingCardTransaction {
  return {
    issuer: "Citibank Online",
    account_last_four: "4596",
    amount: "38.94",
    transaction_type: "purchase",
    category: "groceries",
    plaid_category_detailed: "",
    description: "ShopRite",
    pending: true,
    ...overrides,
  };
}

describe("credit-card account transaction filters", () => {
  it("maps imported Citi card transactions to the rendered Citi liability row", () => {
    expect(accountKeyForTransaction(cardTransaction())).toBe("citi_current");
    expect(
      transactionsForAccount([cardTransaction()], "citi_current"),
    ).toHaveLength(1);
  });

  it("uses dashboard pending summaries before an account register is loaded", () => {
    const totals = importedPendingLiabilityTotals({
      summaryTransactions: [
        cardTransaction({ amount: "46.56" }),
        cardTransaction({ amount: "76.50" }),
        cardTransaction({ amount: "1.00" }),
      ],
    });

    expect(totals.get("citi_current")).toBe(124.06);
  });

  it("replaces account summaries with loaded register transactions", () => {
    const totals = importedPendingLiabilityTotals({
      summaryTransactions: [cardTransaction({ amount: "124.06" })],
      loadedTransactions: {
        citi_current: {
          isLoading: false,
          error: "",
          transactions: [cardTransaction({ amount: "12.34" })],
        },
      },
    });

    expect(totals.get("citi_current")).toBe(12.34);
  });
});
