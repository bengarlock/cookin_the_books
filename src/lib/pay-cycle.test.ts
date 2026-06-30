import { describe, expect, it } from "vitest";

import {
  followingPayday,
  getNextPayCycle,
  remainingPaydaysInYear,
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

  it("returns zero when today is payday", () => {
    expectPayCycle(localDate(2026, 8, 14), localDate(2026, 8, 14), 0);
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

  it("finds the following scheduled payday", () => {
    expectSameLocalDate(
      followingPayday(localDate(2026, 7, 1)),
      localDate(2026, 7, 15),
    );
  });

  it("excludes skipped paydays from the remaining yearly count", () => {
    expect(remainingPaydaysInYear(localDate(2026, 6, 30), "2026-07-15")).toBe(
      remainingPaydaysInYear(localDate(2026, 6, 30)) - 1,
    );
  });
});
