"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useLiveSnapshot } from "@/components/live-snapshot-provider";
import { APP_BASE_PATH } from "@/lib/config";
import { getDashboardPageHeader } from "@/lib/dashboard-page-headers";
import {
  formatSnapshotUpdatedAt,
  getSnapshotFreshness,
  snapshotFreshnessDescriptions,
  snapshotFreshnessLabels,
  type SnapshotFreshness,
} from "@/lib/snapshot-freshness";

function normalizeDashboardPath(pathname: string) {
  const withoutBase = pathname.startsWith(APP_BASE_PATH)
    ? pathname.slice(APP_BASE_PATH.length) || "/"
    : pathname;

  if (withoutBase === "/dashboard") return withoutBase;
  return withoutBase.replace(/\/$/, "");
}

const freshnessStyles: Record<
  SnapshotFreshness,
  { container: string; dot: string }
> = {
  fresh: {
    container: "border-accent/20 bg-accent/10 text-accent",
    dot: "bg-accent shadow-[0_0_12px_rgba(86,226,170,0.8)]",
  },
  stale: {
    container: "border-amber-200/25 bg-amber-200/10 text-amber-100",
    dot: "bg-amber-200",
  },
  expired: {
    container: "border-rose-300/25 bg-rose-500/10 text-rose-200",
    dot: "bg-rose-300",
  },
};

function DataFreshnessIndicator({
  updatedAt,
  currentDate,
}: {
  updatedAt?: string;
  currentDate: Date;
}) {
  const freshness = getSnapshotFreshness(updatedAt, currentDate);
  const styles = freshnessStyles[freshness];

  return (
    <div
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${styles.container}`}
      role="status"
      title={`${snapshotFreshnessDescriptions[freshness]} Last update: ${formatSnapshotUpdatedAt(updatedAt)}.`}
    >
      <span className={`size-2 rounded-full ${styles.dot}`} />
      {snapshotFreshnessLabels[freshness]}
    </div>
  );
}

export function DashboardHeader() {
  const pathname = usePathname();
  const { snapshot } = useLiveSnapshot();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const header = getDashboardPageHeader(normalizeDashboardPath(pathname));

  useEffect(() => {
    const refreshDate = window.setInterval(() => setCurrentDate(new Date()), 60_000);
    return () => window.clearInterval(refreshDate);
  }, []);

  return (
    <header className="relative h-[9.5rem] shrink-0 border-b border-white/10 bg-[#07100f]/70 px-5 backdrop-blur sm:px-8 lg:px-10">
      <div className="flex h-full min-w-0 max-w-3xl flex-col justify-center pr-32 sm:pr-36">
        <p className="line-clamp-1 text-xs font-semibold uppercase tracking-[0.24em] text-gold">
          {header.eyebrow}
        </p>
        <h1 className="mt-2 line-clamp-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {header.title}
        </h1>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
          {header.description}
        </p>
      </div>
      <div className="absolute right-5 top-1/2 -translate-y-1/2 sm:right-8 lg:right-10">
        <DataFreshnessIndicator
          currentDate={currentDate}
          updatedAt={snapshot?.source_updated_at}
        />
      </div>
    </header>
  );
}
