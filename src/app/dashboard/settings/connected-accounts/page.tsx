import type { Metadata } from "next";

import { PlaidConnections } from "@/components/plaid-connections";
import { getPlaidConnections } from "@/lib/plaid-connections";

export const metadata: Metadata = { title: "Connected accounts" };

export default async function ConnectedAccountsSettingsPage() {
  const plaidConnections = await getPlaidConnections();

  return <PlaidConnections initialConnections={plaidConnections} />;
}
