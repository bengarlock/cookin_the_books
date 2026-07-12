export type ExpenseDateRange = {
  start: string;
  end: string;
};

export const DEFAULT_ALL_TIME_START = "1900-01-01";

export function localDateString(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function defaultExpenseDateRange(currentDate = new Date()) {
  const end = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  );
  const start = new Date(end.getFullYear(), 0, 1);

  return {
    start: localDateString(start),
    end: localDateString(end),
  };
}

export function mergeExpenseDateRange(
  current: ExpenseDateRange | undefined,
  imported: ExpenseDateRange,
): ExpenseDateRange {
  if (!current) {
    return imported;
  }

  return {
    start: imported.start < current.start ? imported.start : current.start,
    end: imported.end > current.end ? imported.end : current.end,
  };
}

export function expenseDateRangePreset(
  preset: "week" | "month" | "ytd",
  currentDate = new Date(),
) {
  const end = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  );
  let start: Date;

  if (preset === "week") {
    start = new Date(end);
    start.setDate(end.getDate() - 6);
  } else if (preset === "month") {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  } else {
    start = new Date(end.getFullYear(), 0, 1);
  }

  return {
    start: localDateString(start),
    end: localDateString(end),
  };
}

export function allTimeExpenseDateRange(
  currentDate = new Date(),
  start = DEFAULT_ALL_TIME_START,
) {
  return {
    start,
    end: localDateString(currentDate),
  };
}

export function formatExpenseDateRange(range: ExpenseDateRange) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${formatter.format(parseLocalDate(range.start))} – ${formatter.format(
    parseLocalDate(range.end),
  )}`;
}
