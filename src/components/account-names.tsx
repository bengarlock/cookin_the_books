"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useIsDemo } from "@/components/demo-mode";
import { accountDisplayName, type AccountDisplayNames } from "@/lib/account-links";
import { DEMO_ACCOUNT_NAMES } from "@/lib/demo";
import type { SnapshotAccountKey } from "@/lib/snapshot-types";

const AccountNamesContext = createContext<AccountDisplayNames>({});

/** Names an account falls back to when the user has not renamed it. */
export function useDefaultAccountNames(): AccountDisplayNames {
  return useIsDemo() ? DEMO_ACCOUNT_NAMES : {};
}

function mergeAccountNames(
  defaults: AccountDisplayNames,
  saved: AccountDisplayNames | undefined,
): AccountDisplayNames {
  const names: AccountDisplayNames = { ...defaults };
  for (const [key, value] of Object.entries(saved ?? {})) {
    if (value?.trim()) names[key as SnapshotAccountKey] = value;
  }
  return names;
}

export function AccountNamesProvider({
  names,
  children,
}: {
  names: AccountDisplayNames | undefined;
  children: ReactNode;
}) {
  const defaults = useDefaultAccountNames();
  const value = useMemo(() => mergeAccountNames(defaults, names), [defaults, names]);
  return (
    <AccountNamesContext.Provider value={value}>{children}</AccountNamesContext.Provider>
  );
}

/**
 * Account names to show instead of the built-in labels: the user's saved
 * display names over the demo's fictional defaults. Pass `liveNames` when a
 * component holds settings newer than the layout's.
 */
export function useAccountNames(liveNames?: AccountDisplayNames): AccountDisplayNames {
  const contextNames = useContext(AccountNamesContext);
  const defaults = useDefaultAccountNames();
  return useMemo(
    () => (liveNames ? mergeAccountNames(defaults, liveNames) : contextNames),
    [contextNames, defaults, liveNames],
  );
}

export function useAccountLabel(liveNames?: AccountDisplayNames) {
  const names = useAccountNames(liveNames);
  return useMemo(
    () => (key: SnapshotAccountKey) => accountDisplayName(key, names),
    [names],
  );
}
