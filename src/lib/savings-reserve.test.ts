import { describe, expect, it } from "vitest";

import { getSavingsReservePosition } from "./savings-reserve";

describe("getSavingsReservePosition", () => {
  it("returns a negative variance and restoration amount below target", () => {
    expect(getSavingsReservePosition(27_500)).toEqual({
      target: 30_000,
      variance: -2_500,
      restorationNeeded: 2_500,
    });
  });

  it("returns zero variance at the target", () => {
    expect(getSavingsReservePosition(30_000)).toEqual({
      target: 30_000,
      variance: 0,
      restorationNeeded: 0,
    });
  });

  it("does not earmark an above-target balance for restoration", () => {
    expect(getSavingsReservePosition(32_000)).toEqual({
      target: 30_000,
      variance: 2_000,
      restorationNeeded: 0,
    });
  });
});
