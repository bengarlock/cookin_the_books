import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import type { ExpenseTransaction } from "@/lib/credit-card-transaction-types";
import type { ExpenseDateRange } from "@/lib/expense-date-range";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export type ExpenseTransactionMetadata = {
  earliest_transaction_date: string | null;
  available_years: number[];
};

export const getExpenseTransactions = cache(
  async (range: ExpenseDateRange): Promise<ExpenseTransaction[]> => {
    const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
    if (!token) return [];

    const query = new URLSearchParams({
      start: range.start,
      end: range.end,
    });
    try {
      const response = await fetch(
        `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/credit-card-transactions/expense-summary/?${query}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Token ${token}`,
          },
          cache: "no-store",
        },
      );
      if (!response.ok) return [];
      return (await response.json()) as ExpenseTransaction[];
    } catch {
      return [];
    }
  },
);

export const getExpenseTransactionMetadata = cache(
  async (): Promise<ExpenseTransactionMetadata> => {
    const fallback = {
      earliest_transaction_date: null,
      available_years: [],
    };
    const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
    if (!token) return fallback;

    try {
      const response = await fetch(
        `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/credit-card-transactions/expense-summary-metadata/`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Token ${token}`,
          },
          cache: "no-store",
        },
      );
      if (!response.ok) return fallback;
      return (await response.json()) as ExpenseTransactionMetadata;
    } catch {
      return fallback;
    }
  },
);
