export type SnapshotFreshness = "fresh" | "stale" | "expired";

export function getSnapshotFreshness(
  value: string | undefined,
  currentDate = new Date(),
): SnapshotFreshness {
  if (!value) return "expired";

  const updatedAt = new Date(value);
  const ageInHours =
    (currentDate.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

  if (!Number.isFinite(ageInHours) || ageInHours >= 48) {
    return "expired";
  }
  if (ageInHours >= 24) {
    return "stale";
  }
  return "fresh";
}

export function formatSnapshotUpdatedAt(value?: string) {
  if (!value) return "No snapshot available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const snapshotFreshnessLabels: Record<SnapshotFreshness, string> = {
  fresh: "Data current",
  stale: "Data aging",
  expired: "Data stale",
};

export const snapshotFreshnessDescriptions: Record<SnapshotFreshness, string> = {
  fresh: "Account data was refreshed within the last 24 hours.",
  stale: "Account data has not refreshed in 24 to 48 hours.",
  expired: "Account data has not refreshed in at least 48 hours.",
};
