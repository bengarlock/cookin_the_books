import { describe, expect, it } from "vitest";

import {
  moveOverviewTile,
  reconcileOverviewTileOrder,
} from "./overview-tile-order";

describe("reconcileOverviewTileOrder", () => {
  it("keeps saved tiles in order and appends newly available tiles", () => {
    expect(
      reconcileOverviewTileOrder(
        ["remaining-budget", "total-budget"],
        ["total-budget", "daily-budget", "remaining-budget"],
      ),
    ).toEqual(["remaining-budget", "total-budget", "daily-budget"]);
  });

  it("removes missing and duplicate tile identifiers", () => {
    expect(
      reconcileOverviewTileOrder(
        ["missing", "snapshot", "snapshot"],
        ["snapshot", "net-assets"],
      ),
    ).toEqual(["snapshot", "net-assets"]);
  });
});

describe("moveOverviewTile", () => {
  it("moves the active tile into the hovered tile position", () => {
    expect(
      moveOverviewTile(
        ["total-budget", "remaining-budget", "daily-budget"],
        "daily-budget",
        "total-budget",
      ),
    ).toEqual(["daily-budget", "total-budget", "remaining-budget"]);
  });

  it("leaves the order unchanged when either tile is unavailable", () => {
    const order = ["total-budget", "remaining-budget"];
    expect(moveOverviewTile(order, "missing", "total-budget")).toBe(order);
  });
});
