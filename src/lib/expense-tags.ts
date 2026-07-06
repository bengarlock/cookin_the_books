import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import type { ExpenseTag } from "@/lib/credit-card-transaction-types";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export const getExpenseTags = cache(async (): Promise<ExpenseTag[]> => {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return [];
  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/expense-tags/`,
      {
        headers: { Accept: "application/json", Authorization: `Token ${token}` },
        cache: "no-store",
      },
    );
    return response.ok ? ((await response.json()) as ExpenseTag[]) : [];
  } catch {
    return [];
  }
});
