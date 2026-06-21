import "server-only";

import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";
import type { BankValueSnapshot } from "@/lib/snapshot-types";

export async function getLatestBankValueSnapshot() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/bank-value-snapshots/`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const snapshots = (await response.json()) as BankValueSnapshot[];
    return snapshots[0] || null;
  } catch {
    return null;
  }
}
