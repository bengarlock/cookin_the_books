import type { Metadata } from "next";

import { SnapshotsDashboard } from "@/components/snapshots-dashboard";
import { defaultExpenseDateRange } from "@/lib/expense-date-range";
import { getBankValueSnapshots, getSnapshotBounds } from "@/lib/snapshots";
import { getCreditCardTransactions } from "@/lib/credit-card-transactions";
import { getPendingTransactions } from "@/lib/pending-transactions";

export const metadata: Metadata = {
  title: "Snapshots",
};

export default async function SnapshotsPage() {
  const initialRange = defaultExpenseDateRange();
  const [snapshots, bounds, creditCardTransactions, pendingTransactions] =
    await Promise.all([
    getBankValueSnapshots({
      endDate: initialRange.end,
      includeAccountBalances: false,
      startDate: initialRange.start,
    }),
    getSnapshotBounds(),
    getCreditCardTransactions(),
    getPendingTransactions(),
  ]);

  return (
    <div className="w-full">
      <SnapshotsDashboard
        allTimeStart={bounds.earliest_snapshot_date || undefined}
        initialRange={initialRange}
        initialSnapshots={snapshots}
        initialCreditCardTransactions={creditCardTransactions}
        initialPendingTransactions={pendingTransactions}
      />
    </div>
  );
}
