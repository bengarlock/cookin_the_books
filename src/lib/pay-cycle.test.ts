import { describe, expect, it } from "vitest";

import {
  currentPayPeriodDateRange,
  followingPayday,
  getCurrentPayPeriod,
  getNextPayCycle,
  isValidPaydayOverride,
  localPaydayString,
  remainingPaydaysInYear,
  scheduledPaydaysBetween,
} from "./pay-cycle";

function localDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12);
}

function expectSameLocalDate(actual: Date, expected: Date) {
  expect([
    actual.getFullYear(),
    actual.getMonth(),
    actual.getDate(),
  ]).toEqual([
    expected.getFullYear(),
    expected.getMonth(),
    expected.getDate(),
  ]);
}

function expectPayCycle(
  currentDate: Date,
  expectedPayday: Date,
  expectedDays: number,
) {
  const result = getNextPayCycle(currentDate);

  expect([
    result.nextPayday.getFullYear(),
    result.nextPayday.getMonth() + 1,
    result.nextPayday.getDate(),
  ]).toEqual([
    expectedPayday.getFullYear(),
    expectedPayday.getMonth() + 1,
    expectedPayday.getDate(),
  ]);
  expect(result.daysRemaining).toBe(expectedDays);
}

describe("getNextPayCycle", () => {
  it("finds a normal 1st payday", () => {
    expectPayCycle(localDate(2026, 6, 16), localDate(2026, 7, 1), 15);
  });

  it("finds a normal 15th payday", () => {
    expectPayCycle(localDate(2026, 6, 10), localDate(2026, 6, 15), 5);
  });

  it("moves a Saturday payday to Friday", () => {
    expectPayCycle(localDate(2026, 8, 10), localDate(2026, 8, 14), 4);
  });

  it("moves a Sunday payday to Friday", () => {
    expectPayCycle(localDate(2026, 10, 29), localDate(2026, 10, 30), 1);
  });

  it("rolls into the following month", () => {
    expectPayCycle(localDate(2026, 8, 15), localDate(2026, 9, 1), 17);
  });

  it("rolls into the following year", () => {
    expectPayCycle(localDate(2026, 12, 16), localDate(2027, 1, 1), 16);
  });

  it("advances to the next pay cycle when today is payday", () => {
    expectPayCycle(localDate(2026, 7, 15), localDate(2026, 7, 31), 16);
  });

  it("advances when today is a weekend-adjusted payday", () => {
    expectPayCycle(localDate(2026, 8, 14), localDate(2026, 9, 1), 18);
  });

  it("handles leap day while counting calendar days", () => {
    expectPayCycle(localDate(2028, 2, 29), localDate(2028, 3, 1), 1);
  });

  it("honors a saved future payday override", () => {
    const result = getNextPayCycle(localDate(2026, 6, 30), "2026-07-15");
    expectSameLocalDate(result.nextPayday, localDate(2026, 7, 15));
    expect(result.daysRemaining).toBe(15);
  });

  it("ignores an override after it passes", () => {
    const result = getNextPayCycle(localDate(2026, 7, 16), "2026-07-15");
    expectSameLocalDate(result.nextPayday, localDate(2026, 7, 31));
  });

  it("ignores an override when it is today", () => {
    const result = getNextPayCycle(localDate(2026, 7, 15), "2026-07-15");
    expectSameLocalDate(result.nextPayday, localDate(2026, 7, 31));
    expect(result.daysRemaining).toBe(16);
  });

  it("finds the following scheduled payday", () => {
    expectSameLocalDate(
      followingPayday(localDate(2026, 7, 1)),
      localDate(2026, 7, 15),
    );
  });

  it("resolves the current pay period between scheduled paydays", () => {
    const period = getCurrentPayPeriod(localDate(2026, 7, 8));
    expectSameLocalDate(period.start, localDate(2026, 7, 1));
    expectSameLocalDate(period.end, localDate(2026, 7, 15));
  });

  it("starts a new current period on payday", () => {
    const period = getCurrentPayPeriod(localDate(2026, 7, 15));
    expectSameLocalDate(period.start, localDate(2026, 7, 15));
    expectSameLocalDate(period.end, localDate(2026, 7, 31));
  });

  it("formats the current pay period for date-range controls", () => {
    expect(currentPayPeriodDateRange(localDate(2026, 7, 8))).toEqual({
      start: "2026-07-01",
      end: "2026-07-15",
    });
    expect(
      currentPayPeriodDateRange(localDate(2026, 7, 8), "2026-07-20"),
    ).toEqual({
      start: "2026-07-15",
      end: "2026-07-20",
    });
  });

  it("excludes skipped paydays from the remaining yearly count", () => {
    expect(remainingPaydaysInYear(localDate(2026, 6, 30), "2026-07-15")).toBe(
      remainingPaydaysInYear(localDate(2026, 6, 30)) - 1,
    );
  });
});

describe("one-off payday overrides", () => {
  const earlyDecember = { "2026-12-01": "2026-11-27" };

  it("ends the current pay period on the scheduled payday without overrides", () => {
    expect(currentPayPeriodDateRange(localDate(2026, 11, 28))).toEqual({
      start: "2026-11-13",
      end: "2026-12-01",
    });
  });

  it("starts a new pay period when payroll pays early", () => {
    expect(
      currentPayPeriodDateRange(localDate(2026, 11, 28), null, earlyDecember),
    ).toEqual({ start: "2026-11-27", end: "2026-12-15" });
  });

  it("ends the previous pay period on the early payday", () => {
    expect(
      currentPayPeriodDateRange(localDate(2026, 11, 20), null, earlyDecember),
    ).toEqual({ start: "2026-11-13", end: "2026-11-27" });
  });

  it("counts a late payday in its new pay period", () => {
    const late = { "2026-12-01": "2026-12-03" };
    expect(currentPayPeriodDateRange(localDate(2026, 12, 2), null, late)).toEqual({
      start: "2026-11-13",
      end: "2026-12-03",
    });
    expect(currentPayPeriodDateRange(localDate(2026, 12, 4), null, late)).toEqual({
      start: "2026-12-03",
      end: "2026-12-15",
    });
  });

  it("follows a moved payday when stepping through paydays", () => {
    expect(
      localPaydayString(followingPayday(localDate(2026, 11, 13), earlyDecember)),
    ).toBe("2026-11-27");
    expect(
      localPaydayString(getNextPayCycle(localDate(2026, 11, 20), null, earlyDecember).nextPayday),
    ).toBe("2026-11-27");
  });

  it("does not change the number of paydays left in the year", () => {
    expect(
      remainingPaydaysInYear(localDate(2026, 11, 20), null, earlyDecember),
    ).toBe(remainingPaydaysInYear(localDate(2026, 11, 20)));
  });

  it("lists scheduled weekend-adjusted paydays", () => {
    expect(
      scheduledPaydaysBetween(localDate(2026, 11, 1), localDate(2026, 12, 31)).map(
        localPaydayString,
      ),
    ).toEqual(["2026-11-13", "2026-12-01", "2026-12-15"]);
  });

  it("only accepts overrides that stay between neighboring paydays", () => {
    expect(isValidPaydayOverride("2026-12-01", "2026-11-27")).toBe(true);
    expect(isValidPaydayOverride("2026-12-01", "2026-11-13")).toBe(false);
    expect(isValidPaydayOverride("2026-12-01", "2026-12-15")).toBe(false);
    expect(isValidPaydayOverride("2026-12-02", "2026-11-27")).toBe(false);
  });
});
