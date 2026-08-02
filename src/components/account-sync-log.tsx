"use client";

import { useCallback, useEffect, useState } from "react";

import { APP_BASE_PATH } from "@/lib/config";
import type { AccountSyncLogEntry } from "@/lib/plaid-types";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const statusStyles: Record<AccountSyncLogEntry["status"], string> = {
  queued: "border-amber-200/20 bg-amber-200/10 text-amber-100",
  running: "border-accent/20 bg-accent/10 text-accent",
  succeeded: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  failed: "border-rose-300/20 bg-rose-300/10 text-rose-200",
};

function messageFrom(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    if ("message" in data && typeof data.message === "string") return data.message;
    if ("detail" in data && typeof data.detail === "string") return data.detail;
  }
  return fallback;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

function formatDuration(entry: AccountSyncLogEntry) {
  if (!entry.started_at || !entry.completed_at) return "";
  const milliseconds = new Date(entry.completed_at).getTime() - new Date(entry.started_at).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "";
  if (milliseconds < 1_000) return "under 1 second";
  const seconds = Math.round(milliseconds / 1_000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

function resultSummary(entry: AccountSyncLogEntry) {
  if (entry.status === "queued") return "Waiting for a background worker.";
  if (entry.status === "running") return "The background worker is syncing this institution.";
  if (entry.status === "failed") return entry.error_message || "The sync failed without an error message.";

  const result = entry.result || {};
  const activity = [
    result.created_count ? `${result.created_count} new` : "",
    result.updated_count ? `${result.updated_count} updated` : "",
    result.removed_count ? `${result.removed_count} removed` : "",
    result.balance_updated_count ? `${result.balance_updated_count} balances` : "",
  ].filter(Boolean);
  return activity.length ? activity.join(" · ") : "No account changes were returned.";
}

export function AccountSyncLog() {
  const [logs, setLogs] = useState<AccountSyncLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLogs = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/plaid/connections/sync-log`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | { logs?: AccountSyncLogEntry[]; message?: string; detail?: string }
        | null;
      if (!response.ok) {
        throw new Error(messageFrom(data, "Account sync history could not be loaded."));
      }
      setLogs(data?.logs || []);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Account sync history could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadLogs(), 0);
    const interval = window.setInterval(() => void loadLogs(), 5_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadLogs]);

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Background data sync
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Account Sync Log</h2>
          <p className="mt-1 text-sm text-muted">
            The latest Plaid attempts, including worker progress and backend error details.
          </p>
        </div>
        <button
          className="h-9 min-w-24 rounded-lg border border-white/10 px-3 text-xs font-semibold text-muted transition hover:border-white/20 hover:text-white disabled:opacity-50"
          disabled={isLoading}
          onClick={() => void loadLogs(true)}
          type="button"
        >
          {isLoading ? "Loading…" : "Refresh log"}
        </button>
      </div>

      {error ? (
        <p className="border-b border-rose-300/15 bg-rose-300/10 px-5 py-3 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}

      {logs.length ? (
        <div className="divide-y divide-white/10">
          {logs.map((entry) => {
            const duration = formatDuration(entry);
            const refreshWarning =
              entry.status === "succeeded" &&
              entry.result?.transactions_refresh_status === "failed";
            return (
              <article className="p-5" key={entry.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">
                        {entry.institution_name || "Connected institution"}
                      </h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles[entry.status]}`}
                      >
                        {entry.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-white/75">{resultSummary(entry)}</p>
                    {entry.status === "failed" && entry.error_code ? (
                      <p className="mt-1 font-mono text-xs text-rose-200">Error code: {entry.error_code}</p>
                    ) : null}
                    {refreshWarning ? (
                      <div className="mt-3 rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs leading-5 text-amber-100">
                        Plaid&apos;s on-demand refresh failed
                        {entry.error_code ? ` (${entry.error_code})` : ""}. The normal transaction sync still completed.
                        {entry.error_message ? ` ${entry.error_message}` : ""}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-left text-xs text-muted sm:text-right">
                    <p>{formatDateTime(entry.queued_at)}</p>
                    {duration ? <p className="mt-1">Completed in {duration}</p> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : isLoading ? (
        <p className="p-5 text-sm text-muted">Loading account sync history…</p>
      ) : (
        <p className="p-5 text-sm text-muted">
          No sync attempts have been recorded yet. Use the refresh control above to start one.
        </p>
      )}
    </section>
  );
}
