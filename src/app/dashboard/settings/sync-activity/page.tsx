import type { Metadata } from "next";

import { AccountSyncLog } from "@/components/account-sync-log";

export const metadata: Metadata = { title: "Sync activity" };

export default function SyncActivitySettingsPage() {
  return <AccountSyncLog />;
}
