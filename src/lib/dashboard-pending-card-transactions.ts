import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import type { PendingCardTransaction } from "@/lib/credit-card-transaction-types";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export const getDashboardPendingCardTransactions = cache(async (): Promise<
  PendingCardTransaction[]
> => {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return [];

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/credit-card-transactions/dashboard-summary/`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      pending_card_transactions?: PendingCardTransaction[];
    };
    return data.pending_card_transactions ?? [];
  } catch {
    return [];
  }
});
