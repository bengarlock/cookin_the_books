import {
  DEFAULT_ALL_TIME_START,
  localDateString,
  type ExpenseDateRange,
} from "./expense-date-range";

export const projectionSpendHistoryOptions = [
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "last_6_months", label: "Last 6 months" },
  { value: "year_to_date", label: "Year to date" },
  { value: "all_history", label: "All available history" },
] as const;

export type ProjectionSpendHistory =
  (typeof projectionSpendHistoryOptions)[number]["value"];

export const defaultProjectionSpendHistory: ProjectionSpendHistory =
  "year_to_date";

export function isProjectionSpendHistory(
  value: string | null | undefined,
): value is ProjectionSpendHistory {
  return projectionSpendHistoryOptions.some((option) => option.value === value);
}

export function projectionSpendHistoryDateRange(
  history: ProjectionSpendHistory,
  currentDate = new Date(),
): ExpenseDateRange {
  const end = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  );
  const start = new Date(end);

  if (history === "last_30_days") {
    start.setDate(end.getDate() - 29);
  } else if (history === "last_90_days") {
    start.setDate(end.getDate() - 89);
  } else if (history === "last_6_months") {
    start.setMonth(end.getMonth() - 6);
    start.setDate(start.getDate() + 1);
  } else if (history === "year_to_date") {
    start.setMonth(0, 1);
  } else {
    return { start: DEFAULT_ALL_TIME_START, end: localDateString(end) };
  }

  return { start: localDateString(start), end: localDateString(end) };
}
