import { describe, expect, it } from "vitest";

import {
  isOverviewEmptySlot,
  moveOverviewTile,
  overviewOccupiedColumnSpan,
  reconcileOverviewTileOrder,
} from "./overview-tile-order";

describe("overviewOccupiedColumnSpan", () => {
  it("uses the widest occupied row while preserving empty slots", () => {
    expect(overviewOccupiedColumnSpan([])).toBe(1);
    expect(
      overviewOccupiedColumnSpan([
        "total-budget",
        "days-left",
        "daily-budget",
        "__overview-empty-0",
      ]),
    ).toBe(3);
    expect(
      overviewOccupiedColumnSpan([
        "total-budget",
        "days-left",
        "daily-budget",
        "remaining-budget",
        "projected-savings",
        "credit-card-spend",
        "__overview-empty-0",
        "__overview-empty-1",
        "gross-assets",
        "snapshot",
        "net-assets",
        "__overview-empty-2",
      ]),
    ).toBe(4);
  });
});

describe("reconcileOverviewTileOrder", () => {
  it("keeps saved tiles in order, appends new tiles, and adds grid positions", () => {
    const layout = reconcileOverviewTileOrder(
      ["remaining-budget", "total-budget"],
      ["total-budget", "daily-budget", "remaining-budget"],
    );

    expect(layout.slice(0, 3)).toEqual([
      "remaining-budget",
      "total-budget",
      "daily-budget",
    ]);
    expect(layout).toHaveLength(4);
    expect(isOverviewEmptySlot(layout[3])).toBe(true);
  });

  it("preserves saved empty positions", () => {
    const layout = reconcileOverviewTileOrder(
      [
        "snapshot",
        "__overview-empty-0",
        "net-assets",
        "__overview-empty-1",
      ],
      ["snapshot", "net-assets"],
    );

    expect(layout).toEqual([
      "snapshot",
      "__overview-empty-0",
      "net-assets",
      "__overview-empty-1",
    ]);
  });

  it("removes missing and duplicate tile identifiers", () => {
    const layout = reconcileOverviewTileOrder(
      ["missing", "snapshot", "snapshot"],
      ["snapshot", "net-assets"],
    );

    expect(layout.slice(0, 2)).toEqual(["snapshot", "net-assets"]);
    expect(layout).toHaveLength(4);
  });

  it("removes duplicate empty positions", () => {
    const layout = reconcileOverviewTileOrder(
      [
        "snapshot",
        "__overview-empty-0",
        "__overview-empty-0",
        "net-assets",
      ],
      ["snapshot", "net-assets"],
    );

    expect(layout.filter((id) => id === "__overview-empty-0")).toHaveLength(1);
    expect(layout).toHaveLength(4);
  });

  it("removes retired built-in tiles from saved overview layouts", () => {
    const layout = reconcileOverviewTileOrder(
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
    );

    expect(layout.slice(0, 4)).toEqual([
      "gross-assets",
      "snapshot",
      "net-assets",
      "goal-12",
    ]);
    expect(layout).toHaveLength(8);
    expect(layout.slice(4).every(isOverviewEmptySlot)).toBe(true);
  });

  it("gives a full row of tiles at least one open grid position", () => {
    const layout = reconcileOverviewTileOrder(
      ["one", "two", "three", "four"],
      ["one", "two", "three", "four"],
    );

    expect(layout).toHaveLength(8);
    expect(layout.slice(4).every(isOverviewEmptySlot)).toBe(true);
  });
});

describe("moveOverviewTile", () => {
  it("swaps the active tile with the occupied grid position", () => {
    expect(
      moveOverviewTile(
        ["total-budget", "remaining-budget", "daily-budget"],
        "daily-budget",
        "total-budget",
      ),
    ).toEqual(["daily-budget", "remaining-budget", "total-budget"]);
  });

  it("moves a tile into an empty position and leaves its old position empty", () => {
    expect(
      moveOverviewTile(
        ["total-budget", "__overview-empty-0", "daily-budget"],
        "daily-budget",
        "__overview-empty-0",
      ),
    ).toEqual([
      "total-budget",
      "daily-budget",
      "__overview-empty-0",
    ]);
  });

  it("leaves the order unchanged when either tile is unavailable", () => {
    const order = ["total-budget", "remaining-budget"];
    expect(moveOverviewTile(order, "missing", "total-budget")).toBe(order);
  });

  it("continues swapping the same tile across consecutive hover targets", () => {
    let order = ["total-budget", "remaining-budget", "daily-budget", "snapshot"];

    order = moveOverviewTile(order, "snapshot", "remaining-budget");
    order = moveOverviewTile(order, "snapshot", "total-budget");
    order = moveOverviewTile(order, "snapshot", "daily-budget");

    expect(order).toEqual([
      "daily-budget",
      "total-budget",
      "snapshot",
      "remaining-budget",
    ]);
  });
});
