import "server-only";

import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import type { ExpenseCategoryRule } from "@/lib/expense-category-rule-types";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export async function getExpenseCategoryRules(): Promise<ExpenseCategoryRule[]> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return [];
  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/expense-category-rules/`,
      {
        headers: { Accept: "application/json", Authorization: `Token ${token}` },
        cache: "no-store",
      },
    );
    return response.ok ? ((await response.json()) as ExpenseCategoryRule[]) : [];
  } catch {
    return [];
  }
}
