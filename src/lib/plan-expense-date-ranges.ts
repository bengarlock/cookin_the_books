import {
  defaultExpenseDateRange,
  localDateString,
  parseLocalDate,
  type ExpenseDateRange,
} from "./expense-date-range";

export const PLAN_TRANSACTION_LOOKBACK_DAYS = 180;

function withAnalysisLookback(range: ExpenseDateRange): ExpenseDateRange {
  const start = parseLocalDate(range.start);
  start.setDate(start.getDate() - PLAN_TRANSACTION_LOOKBACK_DAYS);
  return { start: localDateString(start), end: range.end };
}

export function planExpenseTransactionRanges(
  selectedRange: ExpenseDateRange,
  currentDate = new Date(),
): ExpenseDateRange[] {
  const ranges = [selectedRange, defaultExpenseDateRange(currentDate)]
    .map(withAnalysisLookback)
    .sort((left, right) => left.start.localeCompare(right.start));

  return ranges.reduce<ExpenseDateRange[]>((merged, range) => {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      return merged;
    }
    if (range.end > previous.end) previous.end = range.end;
    return merged;
  }, []);
}
