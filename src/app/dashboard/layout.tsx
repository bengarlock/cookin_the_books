import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { verifyPortfolioSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await verifyPortfolioSession();

  if (!session.authenticated) {
    redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
