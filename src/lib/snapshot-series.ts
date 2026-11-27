import type { BankValueSnapshot, SnapshotAccountKey } from "./snapshot-types";

export type SnapshotMetric = "net_assets" | SnapshotAccountKey;

export function snapshotSeries(
  snapshots: BankValueSnapshot[],
  metric: SnapshotMetric,
) {
  return [...snapshots]
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .flatMap((snapshot) => {
      const raw = snapshot[metric];
      const value = Number(raw);
      return raw == null || raw.trim() === "" || !Number.isFinite(value)
        ? []
        : [{ snapshot, value }];
    });
}

export function snapshotSeriesChange(
  series: ReturnType<typeof snapshotSeries>,
) {
  if (series.length < 2) return null;
  const first = series[0].value;
  const amount = series[series.length - 1].value - first;
  return {
    amount,
    percentage: first === 0 ? null : (amount / Math.abs(first)) * 100,
  };
}
