import { describe, expect, it } from "vitest";

import { breakdownEntries, sumBreakdown } from "./income-breakdown";

describe("income breakdown withholdings", () => {
  it("counts paycheck withholdings as positive amounts", () => {
    expect(
      breakdownEntries({ "Medicare Tax": "-57.37", "Federal Income Tax": "-364.60" }),
    ).toEqual([
      ["Federal Income Tax", 364.6],
      ["Medicare Tax", 57.37],
    ]);
  });

  it("subtracts withholding a reversal returns", () => {
    const paycheck = { "Federal Income Tax": "-495.66" };
    const reversal = { "Federal Income Tax": "495.66" };

    expect(sumBreakdown(paycheck) + sumBreakdown(reversal)).toBe(0);
    expect(breakdownEntries(reversal)).toEqual([["Federal Income Tax", -495.66]]);
  });

  it("skips excluded labels and zero or unreadable values", () => {
    expect(
      breakdownEntries(
        { Cell: "-450.00", Fsa: "0.00", Dental: "n/a", "401K": "-623.13" },
        { excludeLabels: ["cell"] },
      ),
    ).toEqual([["401K", 623.13]]);
  });
});
