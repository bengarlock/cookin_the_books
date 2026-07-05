import type { CreditCardTransaction } from "./credit-card-transaction-types";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const AVERAGE_DAYS_PER_MONTH = 365.2425 / 12;

type DateRange = {
  start: number;
  end: number;
};

function dateValue(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

export function effectiveCreditCardTransactionAmount(transaction: CreditCardTransaction) {
  if (transaction.include === false) return 0;
  return Number(transaction.amount) / (transaction.split === true ? 2 : 1);
}

function coveredCalendarDays(
  transactions: CreditCardTransaction[],
  cutoff: string,
  today: string,
) {
  const cutoffValue = dateValue(cutoff);
  const todayValue = dateValue(today);
  const ranges = transactions
    .map((transaction) => ({
      start: Math.max(dateValue(transaction.statement_start), cutoffValue),
      end: Math.min(dateValue(transaction.statement_end), todayValue),
    }))
    .filter((range) => range.start <= range.end)
    .sort((left, right) => left.start - right.start);

  const mergedRanges: DateRange[] = [];
  for (const range of ranges) {
    const previous = mergedRanges.at(-1);
    if (!previous || range.start > previous.end + MILLISECONDS_PER_DAY) {
      mergedRanges.push({ ...range });
    } else {
      previous.end = Math.max(previous.end, range.end);
    }
  }

  return mergedRanges.reduce(
    (days, range) =>
      days + Math.floor((range.end - range.start) / MILLISECONDS_PER_DAY) + 1,
    0,
  );
}

export function creditCardExpenditureAverages(
  transactions: CreditCardTransaction[],
  cutoff: string,
  today: string,
) {
  const expenditures = transactions.filter(
    (transaction) =>
      transaction.transaction_date >= cutoff &&
      transaction.transaction_date <= today &&
      transaction.include !== false &&
      ["purchase", "fee", "interest"].includes(transaction.transaction_type),
  );
  const total = expenditures.reduce(
    (sum, transaction) => sum + effectiveCreditCardTransactionAmount(transaction),
    0,
  );
  const days = coveredCalendarDays(expenditures, cutoff, today);
  const daily = days > 0 ? total / days : 0;

  return {
    total,
    daily,
    weekly: daily * 7,
    monthly: daily * AVERAGE_DAYS_PER_MONTH,
  };
}
