import type { ExpenseTransaction } from "./credit-card-transaction-types";
import type { ReminderRecurrence } from "./financial-reminder-types";

export type RecurringExpenseSuggestion = {
  id: string;
  title: string;
  amount: string;
  due_date: string;
  recurrence_frequency: Exclude<ReminderRecurrence, "none">;
  occurrence_count: number;
  last_occurrence_date: string;
};

type SuggestionTransaction = Pick<
  ExpenseTransaction,
  | "id"
  | "transaction_date"
  | "description"
  | "amount"
  | "transaction_type"
  | "include"
  | "pending"
  | "plaid_counterparty_name"
  | "plaid_counterparty_entity_id"
>;

type ExistingReminder = {
  title: string;
  is_completed: boolean;
};

type CadenceDefinition = {
  recurrence: Exclude<ReminderRecurrence, "none">;
  minimumDays: number;
  maximumDays: number;
  expectedDays: number;
  minimumOccurrences: number;
  maximumAgeDays: number;
};

const cadences: CadenceDefinition[] = [
  {
    recurrence: "weekly",
    minimumDays: 5,
    maximumDays: 9,
    expectedDays: 7,
    minimumOccurrences: 4,
    maximumAgeDays: 14,
  },
  {
    recurrence: "monthly",
    minimumDays: 25,
    maximumDays: 35,
    expectedDays: 30,
    minimumOccurrences: 3,
    maximumAgeDays: 55,
  },
  {
    recurrence: "quarterly",
    minimumDays: 75,
    maximumDays: 105,
    expectedDays: 91,
    minimumOccurrences: 3,
    maximumAgeDays: 170,
  },
  {
    recurrence: "yearly",
    minimumDays: 330,
    maximumDays: 400,
    expectedDays: 365,
    minimumOccurrences: 2,
    maximumAgeDays: 550,
  },
];

const allowedTransactionTypes = new Set(["purchase", "fee", "interest"]);
const genericIdentities = new Set(["merchant", "online payment", "payment", "purchase"]);

function normalizedIdentity(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\d+/g, "#")
    .replace(/[^a-z#]+/g, " ")
    .trim();
}

function suggestionIdentity(transaction: SuggestionTransaction) {
  if (transaction.plaid_counterparty_entity_id.trim()) {
    return `entity:${transaction.plaid_counterparty_entity_id.trim()}`;
  }
  const counterparty = normalizedIdentity(transaction.plaid_counterparty_name);
  if (counterparty && !genericIdentities.has(counterparty)) {
    return `name:${counterparty}`;
  }
  const description = normalizedIdentity(transaction.description);
  return description && !genericIdentities.has(description)
    ? `description:${description}`
    : "";
}

function displayTitle(transaction: SuggestionTransaction) {
  const raw = (transaction.plaid_counterparty_name || transaction.description)
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "Recurring expense";
  const title =
    raw === raw.toLocaleUpperCase()
      ? raw
          .toLocaleLowerCase()
          .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase())
      : raw;
  return title.slice(0, 150);
}

function utcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(left: string, right: string) {
  return Math.round((utcDate(right).getTime() - utcDate(left).getTime()) / 86_400_000);
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function classifyCadence(dates: string[]) {
  const intervals = dates.slice(1).map((date, index) => daysBetween(dates[index], date));
  return cadences
    .filter((cadence) => dates.length >= cadence.minimumOccurrences)
    .map((cadence) => {
      const matches = intervals.filter(
        (interval) =>
          interval >= cadence.minimumDays && interval <= cadence.maximumDays,
      ).length;
      return {
        cadence,
        ratio: matches / intervals.length,
        distance: Math.abs(median(intervals) - cadence.expectedDays),
      };
    })
    .filter((candidate) => candidate.ratio >= 0.75)
    .sort(
      (left, right) =>
        right.ratio - left.ratio || left.distance - right.distance,
    )[0]?.cadence;
}

function addMonths(value: string, months: number) {
  const source = utcDate(value);
  const target = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1),
  );
  const finalDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(source.getUTCDate(), finalDay));
  return dateKey(target);
}

function nextOccurrence(value: string, recurrence: Exclude<ReminderRecurrence, "none">) {
  if (recurrence === "weekly") {
    const next = utcDate(value);
    next.setUTCDate(next.getUTCDate() + 7);
    return dateKey(next);
  }
  return addMonths(
    value,
    recurrence === "monthly" ? 1 : recurrence === "quarterly" ? 3 : 12,
  );
}

function nextDueDate(
  lastOccurrence: string,
  recurrence: Exclude<ReminderRecurrence, "none">,
  today: string,
) {
  let next = nextOccurrence(lastOccurrence, recurrence);
  for (let index = 0; next <= today && index < 120; index += 1) {
    next = nextOccurrence(next, recurrence);
  }
  return next;
}

function stableAmount(transactions: SuggestionTransaction[]) {
  const amounts = transactions
    .map((transaction) => Number(transaction.amount))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  if (amounts.length !== transactions.length) return null;
  const typical = median(amounts);
  const tolerance = Math.max(5, typical * 0.15);
  const matching = amounts.filter((amount) => Math.abs(amount - typical) <= tolerance);
  return matching.length / amounts.length >= 0.75 ? typical : null;
}

function alreadyTracked(title: string, reminders: ExistingReminder[]) {
  const candidate = normalizedIdentity(title);
  return reminders.some((reminder) => {
    if (reminder.is_completed) return false;
    const existing = normalizedIdentity(reminder.title);
    return (
      existing === candidate ||
      (Math.min(existing.length, candidate.length) >= 5 &&
        (existing.includes(candidate) || candidate.includes(existing)))
    );
  });
}

export function recurringExpenseSuggestionRange(today = new Date()) {
  const end = new Date(today);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 800);
  return { start: dateKey(start), end: dateKey(end) };
}

export function buildRecurringExpenseSuggestions(
  transactions: SuggestionTransaction[],
  reminders: ExistingReminder[],
  today: string,
): RecurringExpenseSuggestion[] {
  const groups = new Map<string, SuggestionTransaction[]>();
  for (const transaction of transactions) {
    if (
      transaction.include === false ||
      transaction.pending === true ||
      !allowedTransactionTypes.has(transaction.transaction_type) ||
      transaction.transaction_date > today
    ) {
      continue;
    }
    const identity = suggestionIdentity(transaction);
    if (!identity) continue;
    groups.set(identity, [...(groups.get(identity) || []), transaction]);
  }

  const suggestions: RecurringExpenseSuggestion[] = [];
  for (const [identity, groupedTransactions] of groups) {
    const byDate = new Map<string, SuggestionTransaction>();
    for (const transaction of groupedTransactions) {
      if (!byDate.has(transaction.transaction_date)) {
        byDate.set(transaction.transaction_date, transaction);
      }
    }
    const series = Array.from(byDate.values()).sort((left, right) =>
      left.transaction_date.localeCompare(right.transaction_date),
    );
    const dates = series.map((transaction) => transaction.transaction_date);
    const cadence = classifyCadence(dates);
    const typicalAmount = stableAmount(series);
    if (!cadence || typicalAmount === null) continue;

    const lastOccurrence = dates.at(-1)!;
    if (daysBetween(lastOccurrence, today) > cadence.maximumAgeDays) continue;
    const title = displayTitle(series.at(-1)!);
    if (alreadyTracked(title, reminders)) continue;

    suggestions.push({
      id: identity,
      title,
      amount: typicalAmount.toFixed(2),
      due_date: nextDueDate(lastOccurrence, cadence.recurrence, today),
      recurrence_frequency: cadence.recurrence,
      occurrence_count: series.length,
      last_occurrence_date: lastOccurrence,
    });
  }

  return suggestions
    .sort(
      (left, right) =>
        left.due_date.localeCompare(right.due_date) ||
        right.occurrence_count - left.occurrence_count,
    )
    .slice(0, 6);
}
