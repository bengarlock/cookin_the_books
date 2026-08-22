"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

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

type PlaidQueuedSync = {
  connection_id: number;
  institution_name: string;
  task_id: string;
};

type PlaidSyncTaskStatus = {
  task_id: string;
  state: string;
  ready: boolean;
  successful: boolean;
  failed: boolean;
  result?: {
    created_count?: number;
    updated_count?: number;
    removed_count?: number;
    balance_updated_count?: number;
    transactions_refresh_status?: string;
    transactions_refresh_error?: string;
    transactions_refresh_error_code?: string;
  } | null;
  error?: string;
};

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
  const router = useRouter();
  const { snapshot, setSnapshot } = useLiveSnapshot();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");
  const header = getDashboardPageHeader(normalizeDashboardPath(pathname));

  useEffect(() => {
    const refreshDate = window.setInterval(() => setCurrentDate(new Date()), 60_000);
    return () => window.clearInterval(refreshDate);
  }, []);

  useEffect(() => {
    if (isRefreshing || refreshError || !refreshMessage) return;

    const clearStatus = window.setTimeout(() => {
      setRefreshMessage("");
    }, 5_000);

    return () => window.clearTimeout(clearStatus);
  }, [isRefreshing, refreshError, refreshMessage]);

  async function fetchLatestSnapshot() {
    const response = await fetch(`${APP_BASE_PATH}/api/snapshots/latest`, {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as
      | BankValueSnapshot
      | { message?: string; detail?: string }
      | null;
    if (!response.ok) {
      throw new Error(
        readableErrorMessage(data, "Latest account data could not be loaded."),
      );
    }
    return data && "id" in data ? data : null;
  }

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

  async function waitForPlaidSyncJobs(queued: PlaidQueuedSync[]) {
    const taskIds = queued.map((item) => item.task_id).filter(Boolean);
    if (!taskIds.length) return [] as PlaidSyncTaskStatus[];

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const statuses = await fetchPlaidSyncTaskStatuses(taskIds);
      if (statuses.length && statuses.every((task) => task.ready)) {
        return statuses;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
    }

    throw new Error(
      "Plaid sync is still running in the background. Check Data current again shortly.",
    );
  }

  function summarizePlaidSyncStatus(
    queued: PlaidQueuedSync[],
    statuses: PlaidSyncTaskStatus[],
  ) {
    const queuedByTaskId = new Map(queued.map((item) => [item.task_id, item]));
    const failedTasks = statuses.filter((task) => task.failed);
    if (failedTasks.length) {
      const institutions = failedTasks
        .map((task) => queuedByTaskId.get(task.task_id)?.institution_name || task.task_id)
        .join(", ");
      throw new Error(`Plaid sync failed for: ${institutions}.`);
    }

    const totals = statuses.reduce(
      (summary, task) => {
        const result = task.result || {};
        return {
          created: summary.created + (result.created_count || 0),
          updated: summary.updated + (result.updated_count || 0),
          removed: summary.removed + (result.removed_count || 0),
          balances: summary.balances + (result.balance_updated_count || 0),
        };
      },
      { created: 0, updated: 0, removed: 0, balances: 0 },
    );
    const refreshWarnings = statuses
      .filter((task) => task.result?.transactions_refresh_status === "failed")
      .map((task) => queuedByTaskId.get(task.task_id)?.institution_name || task.task_id);
    const activity = [
      totals.created ? `${totals.created} new` : "",
      totals.updated ? `${totals.updated} updated` : "",
      totals.removed ? `${totals.removed} removed` : "",
      totals.balances ? `${totals.balances} balance refreshes` : "",
    ].filter(Boolean);
    const base = activity.length
      ? `Plaid sync complete: ${activity.join(", ")}.`
      : "Plaid sync complete. No new account changes were returned.";
    return refreshWarnings.length
      ? `${base} Refresh request timed out for ${refreshWarnings.join(", ")}, but normal sync completed.`
      : base;
  }

  async function refreshAccountData() {
    setIsRefreshing(true);
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
      const statuses = await waitForPlaidSyncJobs(queued);
      const summary = summarizePlaidSyncStatus(queued, statuses);
      const latestSnapshot = await fetchLatestSnapshot();
      const nextSnapshot = latestSnapshot || data?.snapshot;
      if (nextSnapshot) {
        setSnapshot(nextSnapshot);
        setCurrentDate(new Date());
      }
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
      } else {
        setRefreshMessage(summary);
      }
      router.refresh();
    } catch (error) {
      setRefreshMessage("");
      setRefreshError(
        error instanceof Error
          ? error.message
          : "Account data could not be refreshed.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <header className="dashboard-header relative h-[9.5rem] shrink-0 border-b border-white/10 bg-[#07111f]/70 px-5 backdrop-blur sm:px-8 lg:px-10">
      <div className="flex h-full min-w-0 max-w-3xl flex-col justify-center pr-32 sm:pr-36">
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
            error={refreshError}
            isRefreshing={isRefreshing}
            onRefresh={() => void refreshAccountData()}
            statusMessage={refreshMessage}
            updatedAt={snapshot?.source_updated_at}
          />
        </div>
      </div>
    </header>
  );
}
