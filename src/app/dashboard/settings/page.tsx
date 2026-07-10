import type { Metadata } from "next";

import { PlaidConnections } from "@/components/plaid-connections";
import { getPlaidConnections } from "@/lib/plaid-connections";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const plaidConnections = await getPlaidConnections();

  return (
    <div className="w-full space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          Settings
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
          App settings
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Manage connected services and background data sync behavior.
        </p>
      </section>

      <PlaidConnections initialConnections={plaidConnections} />
    </div>
  );
}
