import { describe, expect, it } from "vitest";

import type { CreditCardTransaction } from "./credit-card-transaction-types";
import type { IncomeEntry } from "./income-entry-types";
import {
  incomeLedgerTotals,
  reconcileSyncedIncome,
} from "./income-reconciliation";

function incomeEntry(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
  return {
    id: 1,
    employer: "Imported employer",
    employee_name: "",
    period_start: "2026-06-16",
    period_end: "2026-06-30",
    pay_date: "2026-06-30",
    gross_pay: "4000.00",
    net_pay: "2605.17",
    federal_taxable_wages: null,
    advice_number: "",
    source_type: "income_statement_pdf",
    source_identifier: "statement.pdf",
    statement_pdf_url: "",
    breakdown: {},
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function transaction(
  overrides: Partial<CreditCardTransaction> = {},
): CreditCardTransaction {
  return {
    id: 10,
    budget_item: null,
    issuer: "Chase Checking",
    account_last_four: "0277",
    statement_start: "2026-06-01",
    statement_end: "2026-06-30",
    transaction_date: "2026-06-30",
    posting_date: null,
    description: "PAYROLL DEPOSIT",
    amount: "2605.17",
    transaction_type: "credit",
    source_identifier: "plaid-10",
    category: "income",
    category_confidence: null,
    category_source: "plaid",
    categorized_at: null,
    tags: [],
    split: false,
    include: true,
    note: "",
    plaid_category_primary: "INCOME",
    plaid_category_detailed: "INCOME_WAGES",
    plaid_category_confidence: "",
    plaid_category_icon_url: "",
    plaid_legacy_categories: [],
    plaid_legacy_category_id: "",
    plaid_payment_channel: "",
    plaid_transaction_type: "",
    plaid_counterparty_name: "",
    plaid_counterparty_type: "",
    plaid_counterparty_entity_id: "",
    pending: false,
    manual_match: null,
    related_transactions: [],
    created_at: "",
    ...overrides,
  };
}

describe("reconcileSyncedIncome", () => {
  it("matches an exact paycheck deposit within three days", () => {
    const result = reconcileSyncedIncome(
      [incomeEntry()],
      [transaction({ transaction_date: "2026-07-02" })],
    );

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].incomeEntry.employer).toBe("Imported employer");
    expect(result.unmatchedTransactions).toEqual([]);
  });

  it("does not merge a different amount or a non-imported entry", () => {
    const transactions = [transaction(), transaction({ id: 11, amount: "0.21" })];
    const result = reconcileSyncedIncome(
      [incomeEntry({ source_type: "manual" })],
      transactions,
    );

    expect(result.matches).toEqual([]);
    expect(result.unmatchedTransactions).toEqual(transactions);
  });

  it("uses each imported paycheck at most once", () => {
    const result = reconcileSyncedIncome(
      [incomeEntry()],
      [transaction(), transaction({ id: 11 })],
    );

    expect(result.matches).toHaveLength(1);
    expect(result.unmatchedTransactions.map((item) => item.id)).toEqual([11]);
  });
});

describe("incomeLedgerTotals", () => {
  it("adds unmatched included synced income to gross and net without double counting paychecks", () => {
    const totals = incomeLedgerTotals(
      [incomeEntry()],
      [
        transaction(),
        transaction({
          id: 11,
          amount: "25.00",
          transaction_date: "2026-06-20",
        }),
        transaction({
          id: 12,
          amount: "10.00",
          include: false,
          transaction_date: "2026-06-21",
        }),
      ],
      { start: "2026-06-01", end: "2026-06-30" },
    );

    expect(totals.gross).toBe(4025);
    expect(totals.net).toBe(2630.17);
    expect(totals.syncedTotal).toBe(25);
  });
});
