const PAYDAYS = [1, 15] as const;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type PayCycle = {
  nextPayday: Date;
  daysRemaining: number;
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

export function getNextPayCycle(currentDate = new Date()): PayCycle {
  const today = startOfLocalDay(currentDate);
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

export function formatPayday(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function remainingPaydaysInYear(currentDate = new Date()) {
  const today = startOfLocalDay(currentDate);
  const year = today.getFullYear();
  const candidates: Date[] = [];

  for (let month = 0; month < 12; month += 1) {
    for (const payday of PAYDAYS) {
      candidates.push(adjustWeekendPayday(new Date(year, month, payday)));
    }
  }

  return candidates.filter((candidate) => candidate > today).length;
}
