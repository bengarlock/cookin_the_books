import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AuthInvalidationBoundary } from "@/components/auth-invalidation-boundary";
import { DashboardShell } from "@/components/dashboard-shell";
import { DemoModeProvider } from "@/components/demo-mode";
import { LiveSnapshotProvider } from "@/components/live-snapshot-provider";
import { verifyPortfolioSession } from "@/lib/auth";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";
import { DEMO_COOKIE_NAME, DEMO_ENTRY_PATH } from "@/lib/demo";
import { getLatestBankValueSnapshot } from "@/lib/snapshots";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [session, latestSnapshot, budgetPlanSettings] = await Promise.all([
    verifyPortfolioSession(),
    getLatestBankValueSnapshot(),
    getBudgetPlanSettings(),
  ]);

  if (!session.authenticated) {
    // Demo tokens rotate daily and on the nightly reset; send demo visitors
    // straight back through the demo link instead of the login form.
    if ((await cookies()).get(DEMO_COOKIE_NAME)?.value) {
      redirect(DEMO_ENTRY_PATH);
    }

    if (session.invalidToken) {
      redirect(`/api/auth/logout?next=${encodeURIComponent("/login")}`);
    }

    redirect("/login");
  }

  const isDemo = session.isDemo === true;

  return (
    <DemoModeProvider isDemo={isDemo}>
      <LiveSnapshotProvider initialSnapshot={latestSnapshot}>
        <AuthInvalidationBoundary isDemo={isDemo} />
        <DashboardShell
          initialNavigationPreferences={budgetPlanSettings.navigation_preferences}
          isDemo={isDemo}
        >
          {children}
        </DashboardShell>
      </LiveSnapshotProvider>
    </DemoModeProvider>
  );
}
