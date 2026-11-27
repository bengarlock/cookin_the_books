"use client";

import { createContext, useContext, type ReactNode } from "react";

const DemoModeContext = createContext(false);

export function DemoModeProvider({
  isDemo,
  children,
}: {
  isDemo: boolean;
  children: ReactNode;
}) {
  return (
    <DemoModeContext.Provider value={isDemo}>{children}</DemoModeContext.Provider>
  );
}

/** True when the signed-in user is the public demo account. */
export function useIsDemo() {
  return useContext(DemoModeContext);
}

export const DEMO_DISABLED_MESSAGE =
  "Disabled in the demo so visitors can't connect real accounts or mailboxes.";

export function DemoBanner() {
  return (
    <div
      className="flex flex-col gap-1 border-b border-accent/25 bg-accent/10 px-5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"
      role="note"
    >
      <p className="text-foreground">
        <span className="font-semibold text-accent">Demo mode.</span>{" "}
        All accounts and transactions are generated sample data. Feel free to
        edit anything; the demo resets nightly.
      </p>
      <a
        className="shrink-0 font-semibold text-accent hover:underline"
        href="https://bengarlock.com"
      >
        About the developer →
      </a>
    </div>
  );
}
