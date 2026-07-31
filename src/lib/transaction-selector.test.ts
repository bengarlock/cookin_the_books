import { describe, expect, it } from "vitest";

import type { CreditCardTransaction } from "./credit-card-transaction-types";
import {
  selectTransactions,
  transactionMatchesCondition,
} from "./transaction-selector";

const transaction = {
  amount: "100.00",
  transaction_type: "purchase",
} as CreditCardTransaction;

describe("transactionMatchesCondition amount comparisons", () => {
  it("supports greater than or equal to", () => {
    expect(transactionMatchesCondition(transaction, {
      id: "gte",
      field: "amount",
      operator: "greater_than_or_equal",
      value: "100",
    })).toBe(true);
  });

  it("supports less than or equal to", () => {
    expect(transactionMatchesCondition(transaction, {
      id: "lte",
      field: "amount",
      operator: "less_than_or_equal",
      value: "100",
    })).toBe(true);
  });
});

describe("transactionMatchesCondition text comparisons", () => {
  it("supports does not equal", () => {
    const textTransaction = {
      ...transaction,
      description: "Coffee shop",
    } as CreditCardTransaction;

    expect(transactionMatchesCondition(textTransaction, {
      id: "not-equals",
      field: "description",
      operator: "not_equals",
      value: "Tea shop",
    })).toBe(true);
    expect(transactionMatchesCondition(textTransaction, {
      id: "not-equals-match",
      field: "description",
      operator: "not_equals",
      value: "Coffee shop",
    })).toBe(false);
  });
});

describe("transactionMatchesCondition category comparisons", () => {
  const diningTransaction = {
    ...transaction,
    category: "dining",
  } as CreditCardTransaction;

  it("matches category keys without case sensitivity", () => {
    expect(transactionMatchesCondition(diningTransaction, {
      id: "category",
      field: "category",
      operator: "equals",
      value: "DINING",
    })).toBe(true);

    expect(transactionMatchesCondition(diningTransaction, {
      id: "other-category",
      field: "category",
      operator: "not_equals",
      value: "groceries",
    })).toBe(true);
  });
});

describe("transactionMatchesCondition status comparisons", () => {
  const posted = { ...transaction, pending: false } as CreditCardTransaction;
  const pending = { ...transaction, pending: true } as CreditCardTransaction;

  it("selects posted, pending, or both transaction states", () => {
    const condition = {
      id: "status",
      field: "transaction_status" as const,
      operator: "equals" as const,
      value: "posted",
    };

    expect(transactionMatchesCondition(posted, condition)).toBe(true);
    expect(transactionMatchesCondition(pending, condition)).toBe(false);
    expect(
      transactionMatchesCondition(pending, {
        ...condition,
        value: "pending",
      }),
    ).toBe(true);
    expect(
      transactionMatchesCondition(posted, { ...condition, value: "both" }),
    ).toBe(true);
    expect(
      transactionMatchesCondition(pending, { ...condition, value: "both" }),
    ).toBe(true);
  });
});

describe("transactionMatchesCondition pay period comparisons", () => {
  const payPeriodTransaction = {
    ...transaction,
    transaction_date: "2026-07-20",
  } as CreditCardTransaction;

  it("matches the rolling current pay period at evaluation time", () => {
    expect(transactionMatchesCondition(payPeriodTransaction, {
      id: "current-pay-period",
      field: "pay_period",
      operator: "equals",
      value: "current",
    }, new Date(2026, 6, 21))).toBe(true);

    expect(transactionMatchesCondition(payPeriodTransaction, {
      id: "next-current-pay-period",
      field: "pay_period",
      operator: "equals",
      value: "current",
    }, new Date(2026, 7, 3))).toBe(false);
  });

  it("matches fixed pay period ranges", () => {
    expect(transactionMatchesCondition(payPeriodTransaction, {
      id: "fixed-pay-period",
      field: "pay_period",
      operator: "equals",
      value: "2026-07-15..2026-07-31",
    })).toBe(true);

    expect(transactionMatchesCondition(payPeriodTransaction, {
      id: "outside-fixed-pay-period",
      field: "pay_period",
      operator: "not_equals",
      value: "2026-08-01..2026-08-14",
    })).toBe(true);
  });

  it("can carry outstanding pending charges into the selected pay period", () => {
    const condition = {
      id: "current-with-pending",
      field: "pay_period" as const,
      operator: "equals" as const,
      value: "current",
      include_outstanding_pending: true,
    };
    const currentDate = new Date(2026, 6, 31);
    const outsidePeriod = {
      ...transaction,
      transaction_date: "2026-07-30",
    } as CreditCardTransaction;

    expect(
      transactionMatchesCondition(
        { ...outsidePeriod, pending: true },
        condition,
        currentDate,
      ),
    ).toBe(true);
    expect(
      transactionMatchesCondition(
        { ...outsidePeriod, pending: false },
        condition,
        currentDate,
      ),
    ).toBe(false);
    expect(
      transactionMatchesCondition(
        {
          ...outsidePeriod,
          pending: true,
          transaction_type: "payment",
        },
        condition,
        currentDate,
      ),
    ).toBe(false);
  });
});

describe("selectTransactions row logic", () => {
  it("evaluates each row connector from left to right", () => {
    const matching = {
      ...transaction,
      id: 1,
      description: "Coffee shop",
      issuer: "Chase",
    } as CreditCardTransaction;
    const conditions = [
      {
        id: "description",
        field: "description" as const,
        operator: "contains" as const,
        value: "coffee",
      },
      {
        id: "high-amount",
        field: "amount" as const,
        operator: "greater_than" as const,
        value: "200",
        logic_operator: "and" as const,
      },
      {
        id: "issuer",
        field: "issuer" as const,
        operator: "equals" as const,
        value: "Chase",
        logic_operator: "or" as const,
      },
    ];

    expect(selectTransactions([matching], conditions, "and")).toEqual([
      matching,
    ]);
  });
});
