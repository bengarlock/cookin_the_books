import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { LiveSnapshotProvider } from "@/components/live-snapshot-provider";
import { verifyPortfolioSession } from "@/lib/auth";
import { getLatestBankValueSnapshot } from "@/lib/snapshots";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [session, latestSnapshot] = await Promise.all([
    verifyPortfolioSession(),
    getLatestBankValueSnapshot(),
  ]);

  if (!session.authenticated) {
    redirect("/login");
  }

  return (
    <LiveSnapshotProvider initialSnapshot={latestSnapshot}>
      <DashboardShell>{children}</DashboardShell>
    </LiveSnapshotProvider>
  );
}
