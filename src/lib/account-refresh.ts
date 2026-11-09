export type PlaidQueuedSync = {
  connection_id: number;
  institution_name: string;
  task_id: string;
};

export type PlaidSyncTaskStatus = {
  task_id: string;
  state: string;
  ready: boolean;
  successful: boolean;
  failed: boolean;
  bank_refresh_pending?: boolean;
  result?: {
    created_count?: number;
    updated_count?: number;
    removed_count?: number;
    balance_updated_count?: number;
    transactions_refresh_status?: string;
    transactions_refresh_error?: string;
  } | null;
  error?: string;
};

export async function waitForAccountRefresh(
  queued: PlaidQueuedSync[],
  fetchStatuses: (ids: string[]) => Promise<PlaidSyncTaskStatus[]>,
  onProgress: (message: string) => void,
  sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
) {
  const ids = [...new Set(queued.map((item) => item.task_id).filter(Boolean))];
  if (!ids.length) return [];
  let bankWaits = 0;
  for (let attempt = 0; attempt < 75; attempt += 1) {
    const statuses = await fetchStatuses(ids);
    // A partial response must not finish the refresh early.
    const complete = ids.every((id) => statuses.some((task) => task.task_id === id && task.ready));
    if (complete) {
      if (statuses.some((task) => task.failed) || !statuses.some((task) => task.bank_refresh_pending)) {
        return statuses;
      }
      onProgress("Waiting for bank updates…");
      if (bankWaits++ >= 15) return statuses;
    } else {
      onProgress("Syncing accounts…");
      if (attempt >= 59) {
        throw new Error("Account sync is still running. Updates will appear automatically when they arrive.");
      }
    }
    await sleep(2_000);
  }
  throw new Error("Account sync is still running. Updates will appear automatically when they arrive.");
}

export function accountRefreshSummary(queued: PlaidQueuedSync[], statuses: PlaidSyncTaskStatus[]) {
  if (!queued.length) return "No connected accounts were available to refresh.";
  const names = (tasks: PlaidSyncTaskStatus[]) => tasks.map((task) =>
    queued.find((item) => item.task_id === task.task_id)?.institution_name || "a connected bank",
  ).join(", ");
  const failed = statuses.filter((task) => task.failed);
  const warnings = statuses.filter((task) => task.result?.transactions_refresh_status === "failed");
  const pending = statuses.filter((task) => task.bank_refresh_pending);
  const messages = ["Latest available account data loaded."];
  if (failed.length) messages.push(`Sync failed for ${names(failed)}.`);
  if (warnings.length) messages.push(`Bank refresh could not be requested for ${names(warnings)}.`);
  if (pending.length) messages.push(`Refresh requested for ${names(pending)}. Any new bank data will appear automatically.`);
  return messages.join(" ");
}
