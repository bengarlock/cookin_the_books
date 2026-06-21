import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { getPendingTransactions } from "@/lib/pending-transactions";
import { getLatestBankValueSnapshot } from "@/lib/snapshots";

export const metadata: Metadata = {
  title: "Accounts",
};

export default async function AccountsPage() {
  const [latestSnapshot, pendingTransactions] = await Promise.all([
    getLatestBankValueSnapshot(),
    getPendingTransactions(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <section className="border-b border-white/10 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
          Accounts
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Account balances
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          Current cash, credit, investment, and retirement balances from the
          latest portfolio snapshot.
        </p>
      </section>

      <LiveBankValues
        initialSnapshot={latestSnapshot}
        initialPendingTransactions={pendingTransactions}
        view="accounts"
      />
    </div>
  );
}
