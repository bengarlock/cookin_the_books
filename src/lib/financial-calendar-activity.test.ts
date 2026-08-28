import { describe, expect, it } from "vitest";

import type {
  ExpenseTransaction,
  IncomeTransaction,
} from "./credit-card-transaction-types";
import {
  financialCalendarActivities,
  financialCalendarActivityCents,
  financialCalendarDayActivityTotalCents,
  type FinancialCalendarActivity,
} from "./financial-calendar-activity";
import type { IncomeEntry } from "./income-entry-types";

function expense(
  id: number,
  amount: string,
  overrides: Partial<ExpenseTransaction> = {},
): ExpenseTransaction {
  return {
    id,
    budget_item: null,
    issuer: "Bank",
    account_last_four: "1234",
    statement_start: "2026-08-01",
    statement_end: "2026-08-31",
    transaction_date: "2026-08-28",
    posting_date: "2026-08-28",
    description: `Expense ${id}`,
    amount,
    transaction_type: "purchase",
    category: "food",
    category_source: "manual",
    tags: [],
    split: false,
    include: true,
    note: "",
    plaid_category_primary: "FOOD_AND_DRINK",
    plaid_category_detailed: "",
    plaid_counterparty_name: "",
    plaid_counterparty_entity_id: "",
    pending: false,
    related_transaction_ids: [],
    has_amazon_orders: false,
    has_receipt_orders: false,
    ...overrides,
  };
}

function income(
  id: number,
  amount: string,
  overrides: Partial<IncomeTransaction> = {},
): IncomeTransaction {
  return {
    id,
    budget_item: null,
    issuer: "Bank",
    account_last_four: "5678",
    transaction_date: "2026-08-28",
    description: `Income ${id}`,
    amount,
    transaction_type: "credit",
    category: "income",
    include: true,
    plaid_category_primary: "INCOME",
    ...overrides,
  };
}

function incomeEntry(
  id: number,
  netPay: string,
  overrides: Partial<IncomeEntry> = {},
): IncomeEntry {
  return {
    id,
    employer: "Employer",
    employee_name: "Employee",
    period_start: "2026-08-01",
    period_end: "2026-08-15",
    pay_date: "2026-08-28",
    gross_pay: netPay,
    net_pay: netPay,
    federal_taxable_wages: null,
    advice_number: "",
    source_type: "income_statement_pdf",
    source_identifier: `statement-${id}`,
    statement_pdf_url: "",
    breakdown: {},
    created_at: "2026-08-28T12:00:00Z",
    updated_at: "2026-08-28T12:00:00Z",
    ...overrides,
  };
}

describe("financial calendar historical activity", () => {
  it("builds spend and source-of-truth income entries while excluding hidden rows", () => {
    const activities = financialCalendarActivities(
      [
        expense(1, "40.00"),
        expense(2, "10.00", { include: false }),
        expense(6, "20.00", { pending: true }),
        expense(7, "50.00", { split: true }),
      ],
      [
        income(3, "100.00"),
        income(4, "25.00", { category: "account_payment" }),
        income(5, "15.00", { include: false }),
      ],
      [incomeEntry(8, "100.00")],
    );

    expect(activities.map((activity) => activity.key)).toEqual([
      "income-entry-8",
      "spend-1",
      "spend-7",
    ]);
    expect(activities.find((activity) => activity.key === "spend-7")?.amount).toBe(
      "25.00",
    );
  });

  it("treats purchases as losses, refunds as gains, and income as gains", () => {
    const activities: FinancialCalendarActivity[] = [
      { key: "spend-1", date: "2026-08-28", title: "Purchase", amount: "40.00", kind: "spend" },
      { key: "spend-2", date: "2026-08-28", title: "Refund", amount: "-5.00", kind: "spend" },
      { key: "income-3", date: "2026-08-28", title: "Pay", amount: "100.00", kind: "income" },
    ];

    expect(activities.map(financialCalendarActivityCents)).toEqual([
      BigInt(-4000),
      BigInt(500),
      BigInt(10000),
    ]);
    expect(financialCalendarDayActivityTotalCents(activities)).toBe(BigInt(6500));
  });
});
