import "server-only";

import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import type { FinancialGoal } from "@/lib/financial-goal-types";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export async function getFinancialGoals(): Promise<FinancialGoal[]> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return [];

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/financial-goals/`,
      {
        headers: { Accept: "application/json", Authorization: `Token ${token}` },
        cache: "no-store",
      },
    );
    if (!response.ok) return [];
    return (await response.json()) as FinancialGoal[];
  } catch {
    return [];
  }
}
