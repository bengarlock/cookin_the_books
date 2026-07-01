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

export function getNextPayCycle(
  currentDate = new Date(),
  nextPaydayOverride?: string | null,
): PayCycle {
  const today = startOfLocalDay(currentDate);
  const overriddenPayday = dateFromOverride(nextPaydayOverride);
  if (overriddenPayday && overriddenPayday >= today) {
    return {
      nextPayday: overriddenPayday,
      daysRemaining:
        (calendarDayNumber(overriddenPayday) - calendarDayNumber(today)) /
        MILLISECONDS_PER_DAY,
    };
  }
  const candidates: Date[] = [];

  for (let monthOffset = 0; monthOffset <= 2; monthOffset += 1) {
    for (const payday of PAYDAYS) {
      const nominalPayday = new Date(
        today.getFullYear(),
        today.getMonth() + monthOffset,
        payday,
      );
      candidates.push(adjustWeekendPayday(nominalPayday));
    }
  }

  const nextPayday = candidates
    .filter((candidate) => candidate >= today)
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

export function followingPayday(currentPayday: Date) {
  const followingDay = startOfLocalDay(currentPayday);
  followingDay.setDate(followingDay.getDate() + 1);
  return getNextPayCycle(followingDay).nextPayday;
}

function previousScheduledPayday(beforeDate: Date) {
  const candidates: Date[] = [];
  for (let monthOffset = -2; monthOffset <= 0; monthOffset += 1) {
    for (const payday of PAYDAYS) {
      candidates.push(
        adjustWeekendPayday(
          new Date(beforeDate.getFullYear(), beforeDate.getMonth() + monthOffset, payday),
        ),
      );
    }
  }
  return candidates
    .filter((candidate) => candidate < beforeDate)
    .sort((left, right) => right.getTime() - left.getTime())[0];
}

export function getCurrentPayPeriod(
  currentDate = new Date(),
  nextPaydayOverride?: string | null,
): PayPeriod {
  const today = startOfLocalDay(currentDate);
  const nextPayday = getNextPayCycle(today, nextPaydayOverride).nextPayday;
  const startsToday = nextPayday.getTime() === today.getTime();
  const start = startsToday ? today : previousScheduledPayday(nextPayday);
  const nextStart = startsToday ? followingPayday(today) : nextPayday;
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  return { start, end };
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
) {
  const today = startOfLocalDay(currentDate);
  const year = today.getFullYear();
  const overriddenPayday = dateFromOverride(nextPaydayOverride);
  const firstIncludedPayday =
    overriddenPayday && overriddenPayday > today ? overriddenPayday : null;
  const candidates: Date[] = [];

  for (let month = 0; month < 12; month += 1) {
    for (const payday of PAYDAYS) {
      candidates.push(adjustWeekendPayday(new Date(year, month, payday)));
    }
  }

  return candidates.filter(
    (candidate) =>
      candidate > today &&
      (!firstIncludedPayday || candidate >= firstIncludedPayday),
  ).length;
}
