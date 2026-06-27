import { describe, expect, it } from "vitest";

import { getSnapshotFreshness } from "./snapshot-freshness";

describe("getSnapshotFreshness", () => {
  it("marks data under 24 hours old as fresh", () => {
    const now = new Date("2026-06-27T12:00:00Z");
    const updatedAt = new Date("2026-06-27T00:00:00Z").toISOString();

    expect(getSnapshotFreshness(updatedAt, now)).toBe("fresh");
  });

  it("marks data between 24 and 48 hours old as stale", () => {
    const now = new Date("2026-06-27T12:00:00Z");
    const updatedAt = new Date("2026-06-26T10:00:00Z").toISOString();

    expect(getSnapshotFreshness(updatedAt, now)).toBe("stale");
  });

  it("marks data over 48 hours old as expired", () => {
    const now = new Date("2026-06-27T12:00:00Z");
    const updatedAt = new Date("2026-06-24T12:00:00Z").toISOString();

    expect(getSnapshotFreshness(updatedAt, now)).toBe("expired");
  });
});
