import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import type { PlanExpenseTransaction } from "@/lib/credit-card-transaction-types";
import type { ExpenseDateRange } from "@/lib/expense-date-range";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export const getPlanExpenseTransactions = cache(
  async (ranges: ExpenseDateRange[]): Promise<PlanExpenseTransaction[]> => {
    const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
    if (!token) return [];

    try {
      const responses = await Promise.all(
        ranges.map(async (range) => {
          const query = new URLSearchParams({
            start: range.start,
            end: range.end,
          });
          const response = await fetch(
            `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/credit-card-transactions/plan-transactions/?${query}`,
            {
              headers: {
                Accept: "application/json",
                Authorization: `Token ${token}`,
              },
              cache: "no-store",
            },
          );
          if (!response.ok) throw new Error("Unable to load Plan transactions");
          return (await response.json()) as PlanExpenseTransaction[];
        }),
      );

      const transactionsById = new Map<number, PlanExpenseTransaction>();
      for (const transaction of responses.flat()) {
        transactionsById.set(transaction.id, transaction);
      }
      return Array.from(transactionsById.values()).sort(
        (left, right) =>
          right.transaction_date.localeCompare(left.transaction_date) ||
          right.id - left.id,
      );
    } catch {
      return [];
    }
  },
);
