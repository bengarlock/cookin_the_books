import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import type { ExpenseEntry } from "@/lib/expense-entry-types";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export const getExpenseEntries = cache(async (): Promise<ExpenseEntry[]> => {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return [];

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/expense-entries/`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) return [];
    return (await response.json()) as ExpenseEntry[];
  } catch {
    return [];
  }
});
