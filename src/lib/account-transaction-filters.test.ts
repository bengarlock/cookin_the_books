import { describe, expect, it } from "vitest";

import type { PendingCardTransaction } from "./credit-card-transaction-types";
import {
  accountKeyForTransaction,
  accountSelectorLabel,
  accountSelectorOptions,
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
  it("uses canonical account names and explicit account types in selectors", () => {
    expect(
      accountSelectorLabel(
        cardTransaction({
          issuer: "Chase",
          account_last_four: "0277",
        }),
      ),
    ).toBe("Chase Checking •••• 0277");
    expect(accountSelectorLabel(cardTransaction())).toBe(
      "Citi Card · Credit card •••• 4596",
    );
    expect(
      accountSelectorLabel(
        cardTransaction({
          issuer: "Barclays - Cards",
          account_last_four: "4198",
        }),
      ),
    ).toBe("Barclays · Credit card •••• 4198");
  });

  it("uses saved or demo display names, keeping the account type and last four", () => {
    const names = { chase_credit: "Copperline Rewards Visa", chase_checking: "Copperline Checking" };

    expect(
      accountSelectorLabel(
        { issuer: "Copperline Bank", account_last_four: "1164", account_key: "chase_credit" },
        names,
      ),
    ).toBe("Copperline Rewards Visa · Credit card •••• 1164");
    expect(
      accountSelectorLabel(
        { issuer: "Copperline Bank", account_last_four: "4821", account_key: "chase_checking" },
        names,
      ),
    ).toBe("Copperline Checking •••• 4821");
    expect(
      accountSelectorOptions(
        [{ issuer: "Copperline Bank", account_last_four: "1164", account_key: "chase_credit", transaction_type: "purchase" }],
        { names },
      ),
    ).toEqual([{ value: "1164", label: "Copperline Rewards Visa · Credit card •••• 1164" }]);
  });

  it("keeps the built-in label when a display name is blank", () => {
    expect(
      accountSelectorLabel(
        { issuer: "Chase", account_last_four: "9125", account_key: "chase_credit" },
        { chase_credit: "  " },
      ),
    ).toBe("Chase Mastercard · Credit card •••• 9125");
  });

  it("deduplicates and sorts account selector options by their canonical label", () => {
    expect(
      accountSelectorOptions([
        cardTransaction(),
        cardTransaction({ issuer: "Chase", account_last_four: "0277" }),
        cardTransaction({ amount: "99.00" }),
      ]),
    ).toEqual([
      { value: "0277", label: "Chase Checking •••• 0277" },
      { value: "4596", label: "Citi Card · Credit card •••• 4596" },
    ]);
  });

  it("maps imported Citi card transactions to the rendered Citi liability row", () => {
    expect(accountKeyForTransaction(cardTransaction())).toBe("citi_current");
    expect(
      transactionsForAccount([cardTransaction()], "citi_current"),
    ).toHaveLength(1);
  });

  it("keeps replacement card transactions in the same account row", () => {
    const replacement = cardTransaction({
      issuer: "Barclays - Cards",
      account_last_four: "5161",
      account_key: "barclays_card",
    });
    const previous = cardTransaction({
      issuer: "Barclays - Cards",
      account_last_four: "2028",
      account_key: "barclays_card",
    });
    expect(transactionsForAccount([replacement, previous], "barclays_card"))
      .toHaveLength(2);
    expect(accountKeyForTransaction(replacement)).toBe("barclays_card");
    expect(accountSelectorLabel(replacement)).toBe(
      "Barclaycard · Credit card •••• 5161",
    );
    expect(importedPendingLiabilityTotals({ summaryTransactions: [replacement] })
      .get("barclays_card")).toBe(38.94);
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
