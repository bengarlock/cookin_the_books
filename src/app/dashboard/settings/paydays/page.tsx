import type { Metadata } from "next";

import { PaydayOverridesEditor } from "@/components/payday-overrides-editor";

export const metadata: Metadata = { title: "Paydays" };

export default function PaydaySettingsPage() {
  return (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">Paydays</h2>
      <p className="mt-2 mb-6 max-w-2xl text-sm text-muted">
        Paydays normally land on the 1st and 15th, moved to the Friday before when
        they fall on a weekend. When payroll pays early or late, set the date the
        paycheck actually landed. Pay periods, goals, projections, and automations
        use the change for that payday only.
      </p>
      <PaydayOverridesEditor />
    </section>
  );
}
