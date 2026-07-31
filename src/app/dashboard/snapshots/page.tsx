import type { Metadata } from "next";

import { SnapshotsDashboard } from "@/components/snapshots-dashboard";
import { getDashboardPendingCardTransactions } from "@/lib/dashboard-pending-card-transactions";
import { defaultExpenseDateRange } from "@/lib/expense-date-range";
import { getBankValueSnapshots, getSnapshotBounds } from "@/lib/snapshots";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Snapshots",
};

export default async function SnapshotsPage() {
  const initialRange = defaultExpenseDateRange();
  const [snapshots, bounds, pendingCardTransactions, pendingTransactions] =
    await Promise.all([
      getBankValueSnapshots({
        endDate: initialRange.end,
        includeAccountBalances: false,
        startDate: initialRange.start,
      }),
      getSnapshotBounds(),
      getDashboardPendingCardTransactions(),
      getPendingTransactions(),
    ]);

  return (
    <div className="w-full">
      <SnapshotsDashboard
        allTimeStart={bounds.earliest_snapshot_date || undefined}
        initialRange={initialRange}
        initialSnapshots={snapshots}
        initialPendingCardTransactions={pendingCardTransactions}
        initialPendingTransactions={pendingTransactions}
        initialYearlyNetChanges={bounds.yearly_net_changes.map((change) => ({
          change: Number(change.change),
          endDate: change.end_date,
          endValue: Number(change.end_value),
          percentage: Number(change.percentage),
          startDate: change.start_date,
          startValue: Number(change.start_value),
          year: change.year,
        }))}
        snapshotYears={bounds.available_years}
      />
    </div>
  );
}
