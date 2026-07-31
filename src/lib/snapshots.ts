import "server-only";

import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";
import type { BankValueSnapshot } from "@/lib/snapshot-types";

export type SnapshotBounds = {
  available_years: number[];
  earliest_snapshot_date: string | null;
  latest_snapshot_date: string | null;
  yearly_net_changes: Array<{
    change: string;
    end_date: string;
    end_value: string;
    percentage: string;
    start_date: string;
    start_value: string;
    year: string;
  }>;
};

type SnapshotListOptions = {
  endDate?: string;
  includeAccountBalances?: boolean;
  limit?: number;
  startDate?: string;
};

function snapshotSearchParams(options: SnapshotListOptions = {}) {
  const params = new URLSearchParams();
  if (options.startDate) params.set("start_date", options.startDate);
  if (options.endDate) params.set("end_date", options.endDate);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.includeAccountBalances === false) {
    params.set("include_account_balances", "0");
  }
  return params.toString();
}

export async function getBankValueSnapshots(
  options: SnapshotListOptions = {},
): Promise<BankValueSnapshot[]> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return [];
  }

  try {
    const query = snapshotSearchParams(options);
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/bank-value-snapshots/${query ? `?${query}` : ""}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as BankValueSnapshot[];
  } catch {
    return [];
  }
}

export async function getLatestBankValueSnapshot() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/bank-value-snapshots/latest/`,
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

    return (await response.json()) as BankValueSnapshot | null;
  } catch {
    return null;
  }
}

export async function getSnapshotBounds(): Promise<SnapshotBounds> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return {
      available_years: [],
      earliest_snapshot_date: null,
      latest_snapshot_date: null,
      yearly_net_changes: [],
    };
  }

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/bank-value-snapshots/bounds/`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Unable to load snapshot bounds.");
    }

    const bounds = (await response.json()) as Partial<SnapshotBounds>;
    return {
      available_years: bounds.available_years ?? [],
      earliest_snapshot_date: bounds.earliest_snapshot_date ?? null,
      latest_snapshot_date: bounds.latest_snapshot_date ?? null,
      yearly_net_changes: bounds.yearly_net_changes ?? [],
    };
  } catch {
    return {
      available_years: [],
      earliest_snapshot_date: null,
      latest_snapshot_date: null,
      yearly_net_changes: [],
    };
  }
}
