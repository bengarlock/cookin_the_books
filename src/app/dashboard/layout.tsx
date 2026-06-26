import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AuthInvalidationBoundary } from "@/components/auth-invalidation-boundary";
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
    if (session.invalidToken) {
      redirect(`/api/auth/logout?next=${encodeURIComponent("/login")}`);
    }

    redirect("/login");
  }

  return (
    <LiveSnapshotProvider initialSnapshot={latestSnapshot}>
      <AuthInvalidationBoundary />
      <DashboardShell>{children}</DashboardShell>
    </LiveSnapshotProvider>
  );
}
