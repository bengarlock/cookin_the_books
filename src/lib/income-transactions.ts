import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import type { IncomeTransaction } from "@/lib/credit-card-transaction-types";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export const getIncomeTransactions = cache(async (): Promise<
  IncomeTransaction[]
> => {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return [];

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/credit-card-transactions/income-summary/`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) return [];
    return (await response.json()) as IncomeTransaction[];
  } catch {
    return [];
  }
});
