import "server-only";

import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import type { ExpenseAutomationRule } from "@/lib/expense-automation-rule-types";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export async function getExpenseAutomationRules(): Promise<
  ExpenseAutomationRule[]
> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return [];

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/expense-automation-rules/`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) return [];
    return (await response.json()) as ExpenseAutomationRule[];
  } catch {
    return [];
  }
}
