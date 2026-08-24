import type { ReactNode } from "react";

import { SettingsNavigation } from "@/components/settings-navigation";

export default function SettingsLayout({ children }: { children: ReactNode }) {
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
          Manage your appearance, reminders, connected services, and background data sync.
        </p>
      </section>
      <SettingsNavigation />
      {children}
    </div>
  );
}
