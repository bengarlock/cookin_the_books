import type { Metadata } from "next";

import { LiveBankValues } from "@/components/live-bank-values";
import { getLatestBankValueSnapshot } from "@/lib/snapshots";

export const metadata: Metadata = {
  title: "Budget",
};

export default async function BudgetPage() {
  const latestSnapshot = await getLatestBankValueSnapshot();

  return (
    <div className="mx-auto max-w-6xl">
      <section className="border-b border-white/10 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
          Budget
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Pay-cycle planning
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          Budget availability, daily spending guidance, and cash-position
          details calculated from live account balances.
        </p>
      </section>

      <LiveBankValues initialSnapshot={latestSnapshot} view="budget" />
    </div>
  );
}
