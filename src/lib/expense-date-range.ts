export type ExpenseDateRange = {
  start: string;
  end: string;
};

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
  const previousMonthLastDay = new Date(
    end.getFullYear(),
    end.getMonth(),
    0,
  ).getDate();
  const start = new Date(
    end.getFullYear(),
    end.getMonth() - 1,
    Math.min(end.getDate(), previousMonthLastDay),
  );

  return {
    start: localDateString(start),
    end: localDateString(end),
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
