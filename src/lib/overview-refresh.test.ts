import { describe, expect, it, vi } from "vitest";
import { loadOverviewRefresh } from "./overview-refresh";

function fixture() {
  const resources: Record<string, unknown> = {
    "budget-plan-settings/": { budget_offset: "0" },
    "financial-goals/": [], "income-entries/": [],
    "credit-card-transactions/dashboard-summary/": { pending_card_transactions: [{ id: 7 }] },
    "expense-categories/": [], "pending-transactions/": [{ id: 3 }],
    "financial-reminders/": [], "bank-value-snapshots/latest/": { id: 9 },
    "credit-card-transactions/selector-summary/": [{ id: 11 }],
  };
  const read = vi.fn(async <T>(path: string): Promise<T> => resources[path] as T);
  return { resources, read };
}

describe("Overview reload", () => {
  it("returns the snapshot, pending charges and goal transactions as one group", async () => {
    const { resources, read } = fixture();
    resources["financial-goals/"] = [{ is_pinned: true }];
    const payload = await loadOverviewRefresh(read);
    expect(payload.snapshot).toEqual({ id: 9 });
    expect(payload.data.initialPendingTransactions).toEqual([{ id: 3 }]);
    expect(payload.data.initialPendingCardTransactions).toEqual([{ id: 7 }]);
    expect(payload.data.initialGoalTransactions).toEqual([{ id: 11 }]);
  });

  it("rejects an incomplete reload instead of clearing previously loaded data", async () => {
    const { read } = fixture();
    const failedRead = async <T>(path: string): Promise<T> => {
      if (path === "pending-transactions/") throw new Error("Bank API unavailable");
      return read<T>(path);
    };
    await expect(loadOverviewRefresh(failedRead)).rejects.toThrow("Bank API unavailable");
  });

  it("avoids a transaction-history read when no goal needs it", async () => {
    const { read } = fixture();
    expect((await loadOverviewRefresh(read)).data.initialGoalTransactions).toEqual([]);
    expect(read).not.toHaveBeenCalledWith("credit-card-transactions/selector-summary/");
  });
});
