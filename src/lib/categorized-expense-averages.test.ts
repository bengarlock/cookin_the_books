import { describe, expect, it } from "vitest";

import type { CategorizedExpenseTransaction } from "./categorized-expense-averages";
import {
  categorizedExpenseAverages,
  categorizedExpenseCategories,
} from "./categorized-expense-averages";

const range = { start: "2026-01-01", end: "2026-12-31" };
let nextId = 1;

function transaction(
  overrides: Partial<CategorizedExpenseTransaction> = {},
): CategorizedExpenseTransaction {
  return {
    id: nextId++,
    issuer: "Chase",
    account_last_four: "0277",
    transaction_date: "2026-01-02",
    description: "Expense",
    amount: "100.00",
    transaction_type: "purchase",
    category: "groceries",
    category_source: "user_rule",
    split: false,
    include: true,
    pending: false,
    plaid_category_primary: "FOOD_AND_DRINK",
    plaid_category_detailed: "FOOD_AND_DRINK_GROCERIES",
    plaid_counterparty_name: "Merchant",
    plaid_counterparty_entity_id: "merchant-1",
    related_transaction_ids: [],
    ...overrides,
  };
}

describe("categorized expense averages", () => {
  it("uses only posted expenses with user-controlled categories", () => {
    const transactions = [
      transaction({ amount: "100", category_source: "user" }),
      transaction({ amount: "40", category_source: "user_rule", split: true }),
      transaction({ amount: "10", category_source: "manual" }),
      transaction({ amount: "90", category_source: "plaid" }),
      transaction({ amount: "80", category_source: "rules" }),
      transaction({ amount: "70", category: "account_payment" }),
      transaction({ amount: "60", include: false }),
      transaction({ amount: "50", pending: true }),
      transaction({ amount: "40", transaction_type: "payment" }),
    ];

    const averages = categorizedExpenseAverages(transactions, range, range.end);

    expect(averages.total).toBe(130);
    expect(averages.daily).toBeCloseTo(130 / 365);
  });

  it("excludes direct income-tax payments but retains imported property taxes", () => {
    const transactions = [
      transaction({
        amount: "3359.00",
        category: "fees_interest",
        plaid_category_primary: "GOVERNMENT_AND_NON_PROFIT",
        plaid_category_detailed: "GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT",
      }),
      transaction({ amount: "120.00" }),
    ];
    const supplementalExpenses = [
      { amount: "300", category: "property_taxes", incurred_on: "2026-01-08" },
    ];

    expect(
      categorizedExpenseAverages(
        transactions,
        range,
        range.end,
        undefined,
        supplementalExpenses,
      ).total,
    ).toBe(420);
    expect(
      categorizedExpenseCategories(
        transactions,
        range,
        range.end,
        supplementalExpenses,
      ),
    ).toEqual(["groceries", "property_taxes"]);
  });

  it("separates a large loan-principal outlier from recurring mortgage costs", () => {
    const mortgage = (date: string, amount = "2946.76") =>
      transaction({
        transaction_date: date,
        amount,
        category: "housing",
        plaid_category_primary: "LOAN_PAYMENTS",
        plaid_category_detailed: "LOAN_PAYMENTS_MORTGAGE_PAYMENT",
        plaid_counterparty_name: "Mortgage",
        plaid_counterparty_entity_id: "",
      });
    const transactions = [
      mortgage("2026-01-02"),
      mortgage("2026-02-02"),
      mortgage("2026-03-02"),
      mortgage("2026-04-02"),
      mortgage("2026-08-13", "40000.00"),
      mortgage("2026-10-02", "500.00"),
      transaction({
        transaction_date: "2026-09-15",
        description: "Second mortgage payoff",
        amount: "20000.00",
        category: "housing",
        plaid_category_primary: "LOAN_PAYMENTS",
        plaid_category_detailed: "LOAN_PAYMENTS_MORTGAGE_PAYMENT",
        plaid_counterparty_name: "Other lender",
        plaid_counterparty_entity_id: "",
      }),
    ];

    expect(
      categorizedExpenseAverages(transactions, range, range.end).total,
    ).toBe(32_287.04);
  });

  it("keeps a large loan payment when there is no recurring baseline", () => {
    const transactions = [
      transaction({
        transaction_date: "2026-01-02",
        amount: "2946.76",
        category: "housing",
        plaid_category_primary: "LOAN_PAYMENTS",
      }),
      transaction({
        transaction_date: "2026-02-02",
        amount: "2946.76",
        category: "housing",
        plaid_category_primary: "LOAN_PAYMENTS",
      }),
      transaction({
        transaction_date: "2026-08-13",
        amount: "40000.00",
        category: "housing",
        plaid_category_primary: "LOAN_PAYMENTS",
      }),
    ];

    expect(
      categorizedExpenseAverages(transactions, range, range.end).total,
    ).toBe(45_893.52);
  });

  it("nets user-categorized merchant credits while ignoring unconfirmed transfers", () => {
    const purchase = transaction({
      transaction_date: "2026-01-10",
      description: "Amazon marketplace",
      amount: "100.00",
      category: "shopping",
      plaid_category_primary: "GENERAL_MERCHANDISE",
      plaid_counterparty_name: "Amazon",
      plaid_counterparty_entity_id: "amazon",
    });
    const refund = transaction({
      transaction_date: "2026-01-20",
      description: "Amazon refund",
      amount: "40.00",
      transaction_type: "credit",
      category: "shopping",
      plaid_category_primary: "GENERAL_MERCHANDISE",
      plaid_counterparty_name: "Amazon",
      plaid_counterparty_entity_id: "amazon",
    });
    const unconfirmedTransfer = transaction({
      transaction_date: "2026-01-21",
      description: "Cash transfer",
      amount: "50.00",
      transaction_type: "credit",
      category: "shopping",
      plaid_category_primary: "TRANSFER_IN",
      plaid_counterparty_name: "Cash app",
      plaid_counterparty_entity_id: "cash-app",
    });
    const unrelatedCredit = transaction({
      transaction_date: "2026-01-22",
      description: "Insurance settlement",
      amount: "10.00",
      transaction_type: "credit",
      category: "shopping",
      plaid_category_primary: "GENERAL_MERCHANDISE",
      plaid_counterparty_name: "Insurance company",
      plaid_counterparty_entity_id: "",
    });
    const importedStatementRefund = transaction({
      transaction_date: "2026-01-23",
      description: "Legacy merchant credit",
      amount: "-11.64",
      transaction_type: "credit",
      category: "shopping",
      plaid_category_primary: "",
      plaid_counterparty_name: "",
      plaid_counterparty_entity_id: "",
    });

    expect(
      categorizedExpenseAverages(
        [
          purchase,
          refund,
          unconfirmedTransfer,
          unrelatedCredit,
          importedStatementRefund,
        ],
        range,
        range.end,
      ).total,
    ).toBe(48.36);
  });

  it("uses a confirmed linked transfer as a reimbursement", () => {
    const purchase = transaction({
      amount: "200.00",
      category: "utilities",
      plaid_category_primary: "RENT_AND_UTILITIES",
    });
    const reimbursement = transaction({
      transaction_date: "2026-01-05",
      amount: "100.00",
      transaction_type: "credit",
      category: "transportation",
      plaid_category_primary: "TRANSFER_IN",
      related_transaction_ids: [purchase.id],
    });

    expect(
      categorizedExpenseAverages(
        [purchase, reimbursement],
        range,
        range.end,
      ).total,
    ).toBe(100);
  });

  it("recognizes a repeated 50/50 reimbursement pattern one-to-one", () => {
    const transactions: CategorizedExpenseTransaction[] = [];
    for (const month of ["01", "02", "03"]) {
      transactions.push(
        transaction({
          transaction_date: `2026-${month}-01`,
          amount: "2946.76",
          category: "housing",
          plaid_category_primary: "LOAN_PAYMENTS",
          plaid_counterparty_name: "Mortgage",
          plaid_counterparty_entity_id: "",
        }),
        transaction({
          transaction_date: `2026-${month}-03`,
          description: "Apple Cash bank transfer",
          amount: "1473.38",
          transaction_type: "credit",
          category: "transportation",
          plaid_category_primary: "TRANSFER_IN",
          plaid_counterparty_name: "Apple Cash",
          plaid_counterparty_entity_id: "",
        }),
      );
    }
    transactions.push(
      transaction({
        transaction_date: "2026-04-01",
        amount: "100.00",
        category: "utilities",
      }),
      transaction({
        transaction_date: "2026-04-03",
        amount: "50.00",
        transaction_type: "credit",
        category: "transportation",
        plaid_category_primary: "TRANSFER_IN",
        plaid_counterparty_name: "One-off payer",
      }),
    );

    expect(
      categorizedExpenseAverages(transactions, range, range.end).total,
    ).toBe(4_520.14);
    expect(
      categorizedExpenseAverages(
        transactions,
        range,
        range.end,
        "housing",
      ).total,
    ).toBe(4_420.14);
  });

  it("does not apply a transfer reimbursement on top of an existing split", () => {
    const transactions: CategorizedExpenseTransaction[] = [];
    for (const month of ["01", "02", "03"]) {
      transactions.push(
        transaction({
          transaction_date: `2026-${month}-01`,
          amount: "200.00",
          category: "housing",
          split: true,
        }),
        transaction({
          transaction_date: `2026-${month}-03`,
          amount: "100.00",
          transaction_type: "credit",
          category: "housing",
          plaid_category_primary: "TRANSFER_IN",
          plaid_counterparty_name: "Shared payer",
        }),
      );
    }

    expect(
      categorizedExpenseAverages(transactions, range, range.end).total,
    ).toBe(300);
  });

  it("preserves a refund-period actual without forecasting negative spending", () => {
    const purchase = transaction({
      transaction_date: "2025-12-20",
      amount: "100.00",
      category: "shopping",
      plaid_counterparty_name: "Store",
      plaid_counterparty_entity_id: "store",
    });
    const refund = transaction({
      transaction_date: "2026-01-03",
      amount: "100.00",
      transaction_type: "credit",
      category: "shopping",
      plaid_counterparty_name: "Store",
      plaid_counterparty_entity_id: "store",
    });

    const averages = categorizedExpenseAverages(
      [purchase, refund],
      { start: "2026-01-01", end: "2026-01-31" },
      "2026-01-31",
    );

    expect(averages.total).toBe(-100);
    expect(averages.daily).toBe(0);
    expect(averages.monthly).toBe(0);
  });
});
