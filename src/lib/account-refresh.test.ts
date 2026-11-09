import { describe, expect, it, vi } from "vitest";
import { accountRefreshSummary, waitForAccountRefresh, type PlaidSyncTaskStatus } from "./account-refresh";

const queued = [{ connection_id: 1, institution_name: "Test Bank", task_id: "one" }];
const done: PlaidSyncTaskStatus = { task_id: "one", state: "SUCCESS", ready: true, successful: true, failed: false };

describe("account refresh completion", () => {
  it("waits past job success until the bank notification has been consumed", async () => {
    const fetch = vi.fn().mockResolvedValueOnce([{ ...done, bank_refresh_pending: true }]).mockResolvedValue([done]);
    const progress = vi.fn();
    const sleep = vi.fn().mockResolvedValue(undefined);
    expect(await waitForAccountRefresh(queued, fetch, progress, sleep)).toEqual([done]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledWith("Waiting for bank updates…");
  });

  it("does not treat an incomplete status response as completion", async () => {
    const second = { ...queued[0], task_id: "two" };
    const fetch = vi.fn().mockResolvedValueOnce([done]).mockResolvedValue([done, { ...done, task_id: "two" }]);
    await waitForAccountRefresh([...queued, second], fetch, vi.fn(), async () => {});
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("bounds the bank wait without claiming fresh data when no notification arrives", async () => {
    const pending = { ...done, bank_refresh_pending: true };
    const fetch = vi.fn().mockResolvedValue([pending]);
    const statuses = await waitForAccountRefresh(queued, fetch, vi.fn(), async () => {});
    expect(fetch).toHaveBeenCalledTimes(16);
    expect(accountRefreshSummary(queued, statuses)).toContain("Any new bank data will appear automatically");
  });

  it("reports partial failures without discarding healthy account updates", async () => {
    const failed = { ...done, failed: true, successful: false, state: "FAILURE" };
    const statuses = await waitForAccountRefresh(queued, async () => [failed], vi.fn());
    expect(accountRefreshSummary(queued, statuses)).toContain("Sync failed for Test Bank");
    expect(accountRefreshSummary(queued, [{ ...done, result: { transactions_refresh_status: "failed" } }])).toContain("could not be requested");
  });

  it("bounds a missing or stuck job and never queues another sync", async () => {
    const fetch = vi.fn().mockResolvedValue([]);
    await expect(waitForAccountRefresh(queued, fetch, vi.fn(), async () => {})).rejects.toThrow("still running");
    expect(fetch).toHaveBeenCalledTimes(60);
  });

  it("handles no connected institutions without a false sync-complete message", async () => {
    const fetch = vi.fn();
    expect(await waitForAccountRefresh([], fetch, vi.fn())).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(accountRefreshSummary([], [])).toContain("No connected accounts");
  });
});
