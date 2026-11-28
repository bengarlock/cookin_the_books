const PAYDAYS = [1, 15] as const;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type PayCycle = {
  nextPayday: Date;
  daysRemaining: number;
};

export type PayPeriod = {
  start: Date;
  end: Date;
};

/**
 * One-off payroll changes, keyed by the scheduled (weekend-adjusted) payday
 * with the date the paycheck actually lands, both as YYYY-MM-DD.
 */
export type PaydayOverrides = Record<string, string>;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function adjustWeekendPayday(date: Date) {
  const adjusted = new Date(date);

  // Weekend paydays are paid on the preceding Friday.
  if (adjusted.getDay() === 6) {
    adjusted.setDate(adjusted.getDate() - 1);
  } else if (adjusted.getDay() === 0) {
    adjusted.setDate(adjusted.getDate() - 2);
  }

  return adjusted;
}

function calendarDayNumber(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateFromOverride(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : startOfLocalDay(date);
}

function overriddenPayday(
  scheduled: Date,
  paydayOverrides?: PaydayOverrides | null,
) {
  const override = paydayOverrides?.[localPaydayString(scheduled)];
  return dateFromOverride(override) ?? scheduled;
}

// Paydays (with one-off overrides applied) whose scheduled date falls within
// the given month offsets of the base date. One extra month is searched on
// each side so a payday moved across a month boundary is still found.
function paydayCandidates(
  baseDate: Date,
  firstMonthOffset: number,
  lastMonthOffset: number,
  paydayOverrides?: PaydayOverrides | null,
) {
  const candidates: Date[] = [];
  for (
    let monthOffset = firstMonthOffset - 1;
    monthOffset <= lastMonthOffset + 1;
    monthOffset += 1
  ) {
    for (const payday of PAYDAYS) {
      candidates.push(
        overriddenPayday(
          adjustWeekendPayday(
            new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, payday),
          ),
          paydayOverrides,
        ),
      );
    }
  }
  return candidates;
}

/** Scheduled (weekend-adjusted, un-overridden) paydays within [start, end]. */
export function scheduledPaydaysBetween(start: Date, end: Date) {
  const first = startOfLocalDay(start);
  const last = startOfLocalDay(end);
  const paydays: Date[] = [];
  for (
    let month = new Date(first.getFullYear(), first.getMonth() - 1, 1);
    month <= last;
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  ) {
    for (const payday of PAYDAYS) {
      const scheduled = adjustWeekendPayday(
        new Date(month.getFullYear(), month.getMonth(), payday),
      );
      if (scheduled >= first && scheduled <= last) paydays.push(scheduled);
    }
  }
  return paydays.sort((left, right) => left.getTime() - right.getTime());
}

/**
 * A one-off payday must replace a real scheduled payday and still land
 * strictly between the scheduled paydays before and after it.
 */
export function isValidPaydayOverride(scheduled: string, actual: string) {
  const scheduledDate = dateFromOverride(scheduled);
  const actualDate = dateFromOverride(actual);
  if (!scheduledDate || !actualDate) return false;
  const windowStart = new Date(scheduledDate);
  windowStart.setDate(windowStart.getDate() - 31);
  const windowEnd = new Date(scheduledDate);
  windowEnd.setDate(windowEnd.getDate() + 31);
  const neighbors = scheduledPaydaysBetween(windowStart, windowEnd);
  const index = neighbors.findIndex(
    (payday) => payday.getTime() === scheduledDate.getTime(),
  );
  if (index <= 0 || index >= neighbors.length - 1) return false;
  return actualDate > neighbors[index - 1] && actualDate < neighbors[index + 1];
}

export function parsePaydayDate(value?: string | null) {
  return dateFromOverride(value);
}

export function getNextPayCycle(
  currentDate = new Date(),
  nextPaydayOverride?: string | null,
  paydayOverrides?: PaydayOverrides | null,
): PayCycle {
  const today = startOfLocalDay(currentDate);
  const overriddenPayday = dateFromOverride(nextPaydayOverride);
  if (overriddenPayday && overriddenPayday > today) {
    return {
      nextPayday: overriddenPayday,
      daysRemaining:
        (calendarDayNumber(overriddenPayday) - calendarDayNumber(today)) /
        MILLISECONDS_PER_DAY,
    };
  }
  const candidates = paydayCandidates(today, 0, 2, paydayOverrides);

  const nextPayday = candidates
    .filter((candidate) => candidate > today)
    .sort((left, right) => left.getTime() - right.getTime())[0];

  if (!nextPayday) {
    throw new Error("Unable to determine the next payday.");
  }

  return {
    nextPayday,
    daysRemaining:
      (calendarDayNumber(nextPayday) - calendarDayNumber(today)) /
      MILLISECONDS_PER_DAY,
  };
}

export function followingPayday(
  currentPayday: Date,
  paydayOverrides?: PaydayOverrides | null,
) {
  const followingDay = startOfLocalDay(currentPayday);
  followingDay.setDate(followingDay.getDate() + 1);
  return getNextPayCycle(followingDay, null, paydayOverrides).nextPayday;
}

function previousScheduledPayday(
  beforeDate: Date,
  paydayOverrides?: PaydayOverrides | null,
) {
  return paydayCandidates(beforeDate, -2, 0, paydayOverrides)
    .filter((candidate) => candidate < beforeDate)
    .sort((left, right) => right.getTime() - left.getTime())[0];
}

export function getCurrentPayPeriod(
  currentDate = new Date(),
  nextPaydayOverride?: string | null,
  paydayOverrides?: PaydayOverrides | null,
): PayPeriod {
  const today = startOfLocalDay(currentDate);
  const nextPayday = getNextPayCycle(
    today,
    nextPaydayOverride,
    paydayOverrides,
  ).nextPayday;
  const startsToday = nextPayday.getTime() === today.getTime();
  const start = startsToday
    ? today
    : previousScheduledPayday(nextPayday, paydayOverrides);
  const end = startsToday
    ? followingPayday(today, paydayOverrides)
    : nextPayday;
  return { start, end };
}

export function currentPayPeriodDateRange(
  currentDate = new Date(),
  nextPaydayOverride?: string | null,
  paydayOverrides?: PaydayOverrides | null,
) {
  const period = getCurrentPayPeriod(
    currentDate,
    nextPaydayOverride,
    paydayOverrides,
  );
  return {
    start: localPaydayString(period.start),
    end: localPaydayString(period.end),
  };
}

export function localPaydayString(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatPayday(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function remainingPaydaysInYear(
  currentDate = new Date(),
  nextPaydayOverride?: string | null,
  paydayOverrides?: PaydayOverrides | null,
) {
  const today = startOfLocalDay(currentDate);
  const year = today.getFullYear();
  const overriddenPayday = dateFromOverride(nextPaydayOverride);
  const firstIncludedPayday =
    overriddenPayday && overriddenPayday > today ? overriddenPayday : null;
  const candidates = paydayCandidates(
    new Date(year, 0, 1),
    0,
    11,
    paydayOverrides,
  );

  return candidates.filter(
    (candidate) =>
      candidate.getFullYear() === year &&
      candidate > today &&
      (!firstIncludedPayday || candidate >= firstIncludedPayday),
  ).length;
}
