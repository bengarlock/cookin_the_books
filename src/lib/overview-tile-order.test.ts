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

  it("removes retired built-in tiles from saved overview layouts", () => {
    expect(
      reconcileOverviewTileOrder(
        [
          "daily-budget",
          "gross-assets",
          "credit-card-balance",
          "days-until-pay-cycle",
          "snapshot",
          "total-budget",
          "remaining-budget",
          "net-assets",
          "goal-12",
        ],
        ["gross-assets", "snapshot", "net-assets", "goal-12"],
      ),
    ).toEqual(["gross-assets", "snapshot", "net-assets", "goal-12"]);
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

  it("continues moving the same tile across consecutive hover targets", () => {
    let order = ["total-budget", "remaining-budget", "daily-budget", "snapshot"];

    order = moveOverviewTile(order, "snapshot", "remaining-budget");
    order = moveOverviewTile(order, "snapshot", "total-budget");
    order = moveOverviewTile(order, "snapshot", "daily-budget");

    expect(order).toEqual([
      "total-budget",
      "remaining-budget",
      "daily-budget",
      "snapshot",
    ]);
  });
});
