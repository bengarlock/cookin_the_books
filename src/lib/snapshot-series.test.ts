import { describe, expect, it } from "vitest";

import { snapshotSeries, snapshotSeriesChange } from "./snapshot-series";
import type { BankValueSnapshot } from "./snapshot-types";

function snapshot(date: string, etrade: string, netAssets = "900") {
  return { snapshot_date: date, etrade, net_assets: netAssets } as BankValueSnapshot;
}

describe("snapshot balance series", () => {
  it("sorts by date and uses the selected account rather than net assets", () => {
    const snapshots = [snapshot("2026-11-13", "125"), snapshot("2026-11-01", "100")];
    const series = snapshotSeries(snapshots, "etrade");
    expect(series.map(({ value }) => value)).toEqual([100, 125]);
    expect(snapshotSeriesChange(series)).toEqual({ amount: 25, percentage: 25 });
    expect(snapshotSeriesChange(snapshotSeries(snapshots, "net_assets"))).toEqual({ amount: 0, percentage: 0 });
    expect(snapshots[0].snapshot_date).toBe("2026-11-13");
  });

  it("does not turn missing or invalid balances into zero", () => {
    const snapshots = ["", " ", "bad", undefined, null, "Infinity", "0", "10"].map((value, index) =>
      snapshot(`2026-11-${String(index + 1).padStart(2, "0")}`, value as string),
    );
    expect(snapshotSeries(snapshots, "etrade").map(({ value }) => value)).toEqual([0, 10]);
    expect(snapshotSeriesChange(snapshotSeries(snapshots, "etrade"))).toEqual({ amount: 10, percentage: null });
  });

  it("requires two recorded balances and reports losses with their sign", () => {
    expect(snapshotSeriesChange([])).toBeNull();
    expect(snapshotSeriesChange(snapshotSeries([snapshot("2026-11-01", "100")], "etrade"))).toBeNull();
    expect(snapshotSeriesChange(snapshotSeries([
      snapshot("2026-11-01", "100"), snapshot("2026-11-13", "80"),
    ], "etrade"))).toEqual({ amount: -20, percentage: -20 });
  });
});
