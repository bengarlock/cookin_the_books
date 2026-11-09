"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useLiveSnapshot } from "@/components/live-snapshot-provider";
import { APP_BASE_PATH } from "@/lib/config";
import { getDashboardPageHeader } from "@/lib/dashboard-page-headers";
import type { BankValueSnapshot } from "@/lib/snapshot-types";
import {
  formatSnapshotUpdatedAt,
  getSnapshotFreshness,
  snapshotFreshnessDescriptions,
  type SnapshotFreshness,
} from "@/lib/snapshot-freshness";

import {
  accountRefreshSummary,
  waitForAccountRefresh,
  type PlaidQueuedSync,
  type PlaidSyncTaskStatus,
} from "@/lib/account-refresh";

function normalizeDashboardPath(pathname: string) {
  const withoutBase = pathname.startsWith(APP_BASE_PATH)
    ? pathname.slice(APP_BASE_PATH.length) || "/"
    : pathname;

  if (withoutBase === "/dashboard") return withoutBase;
  return withoutBase.replace(/\/$/, "");
}

function readableErrorMessage(data: unknown, fallback: string) {
  const rawMessage =
    data && typeof data === "object" && !Array.isArray(data)
      ? "message" in data && typeof data.message === "string"
        ? data.message
        : "detail" in data && typeof data.detail === "string"
          ? data.detail
          : fallback
      : fallback;

  return rawMessage
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const freshnessStyles: Record<SnapshotFreshness, { container: string }> = {
  fresh: {
    container: "border-accent/20 bg-accent/10 text-accent",
  },
  stale: {
    container: "border-amber-200/25 bg-amber-200/10 text-amber-100",
  },
  expired: {
    container: "border-rose-300/25 bg-rose-500/10 text-rose-200",
  },
};

function DataFreshnessIndicator({
  error,
  isRefreshing,
  onRefresh,
  statusMessage,
  updatedAt,
  currentDate,
}: {
  error: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  statusMessage: string;
  updatedAt?: string;
  currentDate: Date;
}) {
  const freshness = getSnapshotFreshness(updatedAt, currentDate);
  const status = error
    ? "failed"
    : isRefreshing
      ? "syncing"
      : statusMessage
        ? "success"
        : "normal";
  const styles =
    status === "failed"
      ? {
          container: "border-rose-300/25 bg-rose-500/10 text-rose-200",
        }
      : status === "success"
        ? freshnessStyles.fresh
        : status === "syncing"
          ? {
              container: "border-accent/20 bg-accent/10 text-accent",
            }
          : freshnessStyles[freshness];
  const title = error
    ? `${error} Last update: ${formatSnapshotUpdatedAt(updatedAt)}.`
    : statusMessage
      ? `${statusMessage} Last update: ${formatSnapshotUpdatedAt(updatedAt)}.`
    : `${snapshotFreshnessDescriptions[freshness]} Click to refresh account data. Last update: ${formatSnapshotUpdatedAt(updatedAt)}.`;
  const icon = (
    <svg
      aria-hidden="true"
      className={`size-5 ${isRefreshing ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M20 11a8 8 0 0 0-14.9-4M4 5v4h4M4 13a8 8 0 0 0 14.9 4M20 19v-4h-4"
        transform="translate(24 0) scale(-1 1)"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );

  return (
    <button
      aria-label="Refresh account data"
      className={`dashboard-freshness grid size-11 shrink-0 place-items-center rounded-xl border transition hover:brightness-110 disabled:cursor-wait disabled:opacity-80 ${styles.container}`}
      disabled={isRefreshing}
      onClick={onRefresh}
      title={title}
      type="button"
    >
      {icon}
    </button>
  );
}

export function DashboardHeader({
  pathnameOverride,
}: {
  pathnameOverride?: string;
} = {}) {
  const currentPathname = usePathname();
  const pathname = pathnameOverride ?? currentPathname;
  const { snapshot, refreshView, isUpdatingView, viewRefreshError } = useLiveSnapshot();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  const [refreshProgress, setRefreshProgress] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");
  const header = getDashboardPageHeader(normalizeDashboardPath(pathname));

  useEffect(() => {
    const refreshDate = window.setInterval(() => setCurrentDate(new Date()), 60_000);
    return () => window.clearInterval(refreshDate);
  }, []);

  useEffect(() => {
    if (isRefreshing || isUpdatingView || refreshError || !refreshMessage) return;

    const clearStatus = window.setTimeout(() => {
      setRefreshMessage("");
    }, 15_000);

    return () => window.clearTimeout(clearStatus);
  }, [isRefreshing, isUpdatingView, refreshError, refreshMessage]);

  async function fetchPlaidSyncTaskStatuses(taskIds: string[]) {
    const response = await fetch(`${APP_BASE_PATH}/api/plaid/connections/sync-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_ids: taskIds }),
    });
    const data = (await response.json().catch(() => null)) as
      | { tasks?: PlaidSyncTaskStatus[]; message?: string; detail?: string }
      | null;
    if (!response.ok) {
      throw new Error(
        readableErrorMessage(data, "Plaid sync status could not be checked."),
      );
    }
    return data?.tasks || [];
  }

  async function refreshAccountData() {
    if (refreshInFlight.current || isUpdatingView) return;
    refreshInFlight.current = true;
    setIsRefreshing(true);
    setRefreshProgress("Requesting account updates…");
    setRefreshError("");
    setRefreshMessage("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/plaid/connections/sync-all`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        errors?: Array<{ institution_name?: string; detail?: string }>;
        message?: string;
        queued?: PlaidQueuedSync[];
        snapshot?: BankValueSnapshot | null;
      } | null;
      if (!response.ok) {
        throw new Error(
          readableErrorMessage(data, "Account data could not be refreshed."),
        );
      }
      const queued = data?.queued || [];
      const statuses = await waitForAccountRefresh(queued, fetchPlaidSyncTaskStatuses, setRefreshProgress);
      const summary = accountRefreshSummary(queued, statuses);
      setRefreshProgress("Updating account view…");
      await refreshView();
      setCurrentDate(new Date());
      const taskWarnings = statuses.some((task) => task.failed || task.result?.transactions_refresh_status === "failed");
      if (data?.errors?.length) {
        const institutions = data.errors
          .map((error) => error.institution_name || error.detail)
          .filter(Boolean)
          .join(", ");
        setRefreshError(
          institutions
            ? `Some connections could not refresh: ${institutions}.`
            : "Some connections could not refresh.",
        );
      } else if (taskWarnings) {
        setRefreshError(summary);
      } else {
        setRefreshMessage(summary);
      }
    } catch (error) {
      setRefreshMessage("");
      setRefreshError(
        error instanceof Error
          ? error.message
          : "Account data could not be refreshed.",
      );
      // Even partial or timed-out syncs may have changed transactions.
      await refreshView().catch(() => undefined);
    } finally {
      refreshInFlight.current = false;
      setIsRefreshing(false);
    }
  }

  return (
    <header className="dashboard-header relative h-48 shrink-0 sm:h-44 border-b border-white/10 bg-[#07111f]/70 px-5 backdrop-blur sm:px-8 lg:px-10">
      <div className="flex h-[9.5rem] min-w-0 max-w-3xl flex-col justify-center pr-32 sm:pr-36">
        <p className="line-clamp-1 text-xs font-semibold uppercase tracking-[0.24em] text-gold">
          {header.eyebrow}
        </p>
        <h1 className="mt-2 line-clamp-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {header.title}
        </h1>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
          {header.description}
        </p>
      </div>
      <div className="absolute right-5 top-5 sm:right-8 lg:right-10">
        <div className="flex max-w-[28rem] flex-col items-end gap-2">
          <DataFreshnessIndicator
            currentDate={currentDate}
            error={refreshError || viewRefreshError}
            isRefreshing={isRefreshing || isUpdatingView}
            onRefresh={() => void refreshAccountData()}
            statusMessage={refreshMessage}
            updatedAt={snapshot?.source_updated_at}
          />

        </div>
      </div>
      <p role="status" aria-live="polite" className={`absolute inset-x-5 bottom-3 max-h-12 min-h-8 overflow-y-auto text-xs leading-4 sm:inset-x-8 lg:inset-x-10 ${(refreshError || viewRefreshError) ? "text-rose-200" : "text-muted"}`}>
        {isRefreshing ? refreshProgress : isUpdatingView ? "Updating account view…" : refreshError || viewRefreshError || refreshMessage}
      </p>
    </header>
  );
}
