import type { Metadata } from "next";

import { SnapshotsDashboard } from "@/components/snapshots-dashboard";
import { getBankValueSnapshots } from "@/lib/snapshots";

export const metadata: Metadata = {
  title: "Snapshots",
};

export default async function SnapshotsPage() {
  const snapshots = await getBankValueSnapshots();

  return (
    <div className="mx-auto max-w-7xl">
      <section className="border-b border-white/10 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
          Snapshots
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Net worth history
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          One authoritative financial position per day, with account-level
          detail and a permanent historical record.
        </p>
      </section>

      <SnapshotsDashboard initialSnapshots={snapshots} />
    </div>
  );
}
