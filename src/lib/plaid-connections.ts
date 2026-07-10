import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import type { PlaidConnection } from "@/lib/plaid-types";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export const getPlaidConnections = cache(async () => {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return [];

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/plaid/connections/`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) return [];
    return (await response.json()) as PlaidConnection[];
  } catch {
    return [];
  }
});
