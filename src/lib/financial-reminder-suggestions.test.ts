import { describe, expect, it } from "vitest";

import type { ExpenseTransaction } from "./credit-card-transaction-types";
import { buildRecurringExpenseSuggestions } from "./financial-reminder-suggestions";

type SuggestionTransaction = Parameters<typeof buildRecurringExpenseSuggestions>[0][number];

function transaction(
  id: number,
  transactionDate: string,
  overrides: Partial<ExpenseTransaction> = {},
): SuggestionTransaction {
  return {
    id,
    transaction_date: transactionDate,
    description: "STREAMING SERVICE",
    amount: "19.99",
    transaction_type: "purchase",
    include: true,
    pending: false,
    plaid_counterparty_name: "Streaming Service",
    plaid_counterparty_entity_id: "merchant-streaming",
    ...overrides,
  };
}

describe("recurring expense suggestions", () => {
  it("suggests a stable monthly expense with its next expected date", () => {
    const suggestions = buildRecurringExpenseSuggestions(
      [
        transaction(1, "2026-05-15"),
        transaction(2, "2026-06-15"),
        transaction(3, "2026-07-15"),
        transaction(4, "2026-08-15"),
      ],
      [],
      "2026-08-24",
    );

    expect(suggestions).toEqual([
      expect.objectContaining({
        title: "Streaming Service",
        amount: "19.99",
        due_date: "2026-09-15",
        recurrence_frequency: "monthly",
        occurrence_count: 4,
      }),
    ]);
  });

  it("does not suggest irregular or unstable spending", () => {
    const suggestions = buildRecurringExpenseSuggestions(
      [
        transaction(1, "2026-05-15", { amount: "10.00" }),
        transaction(2, "2026-06-15", { amount: "80.00" }),
        transaction(3, "2026-07-15", { amount: "20.00" }),
        transaction(4, "2026-08-15", { amount: "120.00" }),
      ],
      [],
      "2026-08-24",
    );

    expect(suggestions).toEqual([]);
  });

  it("does not duplicate an active Calendar reminder", () => {
    const suggestions = buildRecurringExpenseSuggestions(
      [
        transaction(1, "2026-05-15"),
        transaction(2, "2026-06-15"),
        transaction(3, "2026-07-15"),
        transaction(4, "2026-08-15"),
      ],
      [{ title: "Streaming Service subscription", is_completed: false }],
      "2026-08-24",
    );

    expect(suggestions).toEqual([]);
  });

  it("handles yearly expenses that fall on a leap day", () => {
    const suggestions = buildRecurringExpenseSuggestions(
      [
        transaction(1, "2024-02-29", { amount: "250.00" }),
        transaction(2, "2025-02-28", { amount: "255.00" }),
        transaction(3, "2026-02-28", { amount: "260.00" }),
      ],
      [],
      "2026-08-24",
    );

    expect(suggestions[0]).toEqual(
      expect.objectContaining({
        amount: "255.00",
        due_date: "2027-02-28",
        recurrence_frequency: "yearly",
      }),
    );
  });
});
