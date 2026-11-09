import type { Metadata } from "next";

import { OverviewPageClient } from "@/components/overview-page-client";
import { getOverviewData } from "@/lib/overview-data";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  return <OverviewPageClient initialData={await getOverviewData()} />;
}
