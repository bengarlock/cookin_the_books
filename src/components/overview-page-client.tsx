"use client";

import { useCallback, useEffect, useState } from "react";
import { LiveBankValues } from "@/components/live-bank-values";
import { useLiveSnapshot } from "@/components/live-snapshot-provider";
import { APP_BASE_PATH } from "@/lib/config";
import type { getOverviewData } from "@/lib/overview-data";
import type { BankValueSnapshot } from "@/lib/snapshot-types";

type OverviewData = Awaited<ReturnType<typeof getOverviewData>>;

export function OverviewPageClient({ initialData }: { initialData: OverviewData }) {
  const [data, setData] = useState(initialData);
  const [previousInitialData, setPreviousInitialData] = useState(initialData);
  const { registerDataRefresh, setSnapshot } = useLiveSnapshot();
  if (previousInitialData !== initialData) {
    setPreviousInitialData(initialData);
    setData(initialData);
  }
  const refresh = useCallback(async () => {
    const response = await fetch(`${APP_BASE_PATH}/api/overview`, { cache: "no-store" });
    if (!response.ok) throw new Error("Overview data could not be loaded. Please try again.");
    const payload = await response.json() as { data: OverviewData; snapshot: BankValueSnapshot | null };
    setData(payload.data);
    setSnapshot(payload.snapshot);
  }, [setSnapshot]);
  useEffect(() => registerDataRefresh(refresh), [registerDataRefresh, refresh]);

  return <div className="w-full"><LiveBankValues {...data} view="overview" /></div>;
}
