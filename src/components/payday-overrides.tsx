"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { PaydayOverrides } from "@/lib/pay-cycle";

type PaydayOverridesContextValue = {
  paydayOverrides: PaydayOverrides;
  setPaydayOverrides: Dispatch<SetStateAction<PaydayOverrides>>;
};

const EMPTY_OVERRIDES: PaydayOverrides = {};

const PaydayOverridesContext = createContext<PaydayOverridesContextValue>({
  paydayOverrides: EMPTY_OVERRIDES,
  setPaydayOverrides: () => undefined,
});

/**
 * Shares the user's one-off payday changes (an early or late paycheck) with
 * every pay-period calculation in the dashboard, and lets the editor update
 * them without a full reload.
 */
export function PaydayOverridesProvider({
  initialOverrides,
  children,
}: {
  initialOverrides: PaydayOverrides | undefined;
  children: ReactNode;
}) {
  const [paydayOverrides, setPaydayOverrides] = useState<PaydayOverrides>(
    initialOverrides ?? EMPTY_OVERRIDES,
  );
  const value = useMemo(
    () => ({ paydayOverrides, setPaydayOverrides }),
    [paydayOverrides],
  );
  return (
    <PaydayOverridesContext.Provider value={value}>
      {children}
    </PaydayOverridesContext.Provider>
  );
}

export function usePaydayOverrides() {
  return useContext(PaydayOverridesContext).paydayOverrides;
}

export function useSetPaydayOverrides() {
  return useContext(PaydayOverridesContext).setPaydayOverrides;
}
