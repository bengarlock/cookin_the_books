import { AVERAGE_DAYS_PER_MONTH } from "./expense-averages";
import type { ExpenseDateRange } from "./expense-date-range";
import type { PlanExpenseTransaction } from "./credit-card-transaction-types";

export type CategorizedExpenseTransaction = PlanExpenseTransaction;

export type SupplementalCategorizedExpense = {
  amount: string;
  category: string;
  incurred_on: string;
};

export type ExpenseAverages = {
  total: number;
  daily: number;
  weekly: number;
  monthly: number;
};

type ExpenseEffect = {
  category: string;
  cents: number;
  transactionDate: string;
};

type MatchedCredit = {
  credit: CategorizedExpenseTransaction;
  debit: CategorizedExpenseTransaction;
};

const debitTransactionTypes = new Set(["purchase", "fee", "interest"]);
const excludedCategories = new Set([
  "",
  "account_payment",
  "needs_review",
  "transfer",
]);
const DIRECT_TAX_DETAIL = "GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const REFUND_LOOKBACK_DAYS = 180;
const REIMBURSEMENT_DATE_WINDOW_DAYS = 7;
const REIMBURSEMENT_AMOUNT_TOLERANCE_CENTS = 2;
const MIN_RECURRING_MONTHS = 3;
const RECURRING_AMOUNT_TOLERANCE_CENTS = 500;
const RECURRING_AMOUNT_TOLERANCE_RATIO = 0.02;
const CAPITAL_MULTIPLIER = 3;
const CAPITAL_MINIMUM_EXCESS_CENTS = 500_000;

function calendarDays(start: string, end: string) {
  const startValue = Date.parse(`${start}T00:00:00Z`);
  const endValue = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || endValue < startValue) {
    return 0;
  }
  return Math.floor((endValue - startValue) / MILLISECONDS_PER_DAY) + 1;
}

function dateDistanceDays(left: string, right: string) {
  return Math.abs(
    Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`),
  ) / MILLISECONDS_PER_DAY;
}

function amountCents(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(Math.abs(amount) * 100) : 0;
}

function effectiveCents(transaction: CategorizedExpenseTransaction) {
  const cents = amountCents(transaction.amount);
  return transaction.split ? Math.round(cents / 2) : cents;
}

function normalizedIdentity(value?: string) {
  return (value || "")
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\d+/g, "#")
    .replace(/[^a-z#]+/g, " ")
    .trim();
}

function merchantIdentity(transaction: CategorizedExpenseTransaction) {
  if (transaction.plaid_counterparty_entity_id) {
    return `entity:${transaction.plaid_counterparty_entity_id}`;
  }
  const counterparty = normalizedIdentity(transaction.plaid_counterparty_name);
  if (counterparty) return `name:${counterparty}`;
  const description = normalizedIdentity(transaction.description);
  return description ? `description:${description}` : "";
}

function merchantAliases(transaction: CategorizedExpenseTransaction) {
  return [
    normalizedIdentity(transaction.plaid_counterparty_name),
    normalizedIdentity(transaction.description),
  ].filter(Boolean);
}

const genericMerchantAliases = new Set([
  "credit",
  "merchant",
  "online payment",
  "payment",
  "purchase",
  "refund",
  "statement credit",
]);

function merchantAliasesMatch(left: string, right: string) {
  if (left === right) return !genericMerchantAliases.has(left);
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  return (
    shorter.length >= 4 &&
    !genericMerchantAliases.has(shorter) &&
    longer.startsWith(`${shorter} `)
  );
}

function sameMerchant(
  left: CategorizedExpenseTransaction,
  right: CategorizedExpenseTransaction,
) {
  if (
    left.plaid_counterparty_entity_id &&
    right.plaid_counterparty_entity_id &&
    left.plaid_counterparty_entity_id === right.plaid_counterparty_entity_id
  ) {
    return true;
  }
  return merchantAliases(left).some((leftAlias) =>
    merchantAliases(right).some((rightAlias) =>
      merchantAliasesMatch(leftAlias, rightAlias),
    ),
  );
}

function loanSeriesIdentity(transaction: CategorizedExpenseTransaction) {
  if (transaction.plaid_counterparty_entity_id) {
    return `entity:${transaction.plaid_counterparty_entity_id}`;
  }
  const counterparty = normalizedIdentity(transaction.plaid_counterparty_name);
  if (counterparty) return `name:${counterparty}`;
  return normalizedIdentity(transaction.description).replace(/\bhmg\b/g, "mortgage");
}

function isDirectTax(transaction: CategorizedExpenseTransaction) {
  return transaction.plaid_category_detailed === DIRECT_TAX_DETAIL;
}

function hasExpenseCategory(transaction: CategorizedExpenseTransaction) {
  return (
    Boolean(transaction.category.trim()) && !excludedCategories.has(transaction.category)
  );
}

function isBaseEligible(transaction: CategorizedExpenseTransaction) {
  return (
    transaction.include !== false &&
    transaction.pending !== true &&
    hasExpenseCategory(transaction) &&
    !isDirectTax(transaction)
  );
}

function isDebit(transaction: CategorizedExpenseTransaction) {
  return debitTransactionTypes.has(transaction.transaction_type);
}

function recurringAmountCluster(
  transactions: CategorizedExpenseTransaction[],
) {
  let best: CategorizedExpenseTransaction[] = [];
  for (const candidate of transactions) {
    const candidateCents = amountCents(candidate.amount);
    const tolerance = Math.max(
      RECURRING_AMOUNT_TOLERANCE_CENTS,
      Math.round(candidateCents * RECURRING_AMOUNT_TOLERANCE_RATIO),
    );
    const cluster = transactions.filter(
      (transaction) =>
        Math.abs(amountCents(transaction.amount) - candidateCents) <= tolerance,
    );
    const months = new Set(
      cluster.map((transaction) => transaction.transaction_date.slice(0, 7)),
    );
    const bestMonths = new Set(
      best.map((transaction) => transaction.transaction_date.slice(0, 7)),
    );
    if (
      months.size > bestMonths.size ||
      (months.size === bestMonths.size && cluster.length > best.length)
    ) {
      best = cluster;
    }
  }
  const distinctMonths = new Set(
    best.map((transaction) => transaction.transaction_date.slice(0, 7)),
  );
  return distinctMonths.size >= MIN_RECURRING_MONTHS ? best : [];
}

function medianCents(transactions: CategorizedExpenseTransaction[]) {
  const values = transactions
    .map((transaction) => amountCents(transaction.amount))
    .sort((left, right) => left - right);
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2
    ? values[middle]
    : Math.round((values[middle - 1] + values[middle]) / 2);
}

function capitalLoanPaymentIds(
  transactions: CategorizedExpenseTransaction[],
) {
  const groups = new Map<string, CategorizedExpenseTransaction[]>();
  for (const transaction of transactions) {
    if (
      !isBaseEligible(transaction) ||
      !isDebit(transaction) ||
      transaction.plaid_category_primary !== "LOAN_PAYMENTS"
    ) {
      continue;
    }
    const key = [
      transaction.issuer,
      transaction.account_last_four,
      transaction.category,
      transaction.plaid_category_primary,
      transaction.plaid_category_detailed,
      loanSeriesIdentity(transaction),
    ].join("\0");
    groups.set(key, [...(groups.get(key) || []), transaction]);
  }

  const capitalIds = new Set<number>();
  for (const group of groups.values()) {
    const recurring = recurringAmountCluster(group);
    const baseline = medianCents(recurring);
    if (!baseline) continue;
    for (const transaction of group) {
      const cents = amountCents(transaction.amount);
      if (
        cents >= baseline * CAPITAL_MULTIPLIER &&
        cents - baseline >= CAPITAL_MINIMUM_EXCESS_CENTS
      ) {
        capitalIds.add(transaction.id);
      }
    }
  }
  return capitalIds;
}

function closestDebit(
  credit: CategorizedExpenseTransaction,
  candidates: CategorizedExpenseTransaction[],
) {
  return [...candidates].sort(
    (left, right) =>
      dateDistanceDays(left.transaction_date, credit.transaction_date) -
        dateDistanceDays(right.transaction_date, credit.transaction_date) ||
      right.transaction_date.localeCompare(left.transaction_date) ||
      left.id - right.id,
  )[0];
}

function recurringReimbursementPairs(
  credits: CategorizedExpenseTransaction[],
  debits: CategorizedExpenseTransaction[],
  unavailableDebitIds: Set<number>,
) {
  const tentative: MatchedCredit[] = [];
  const tentativelyUsedDebitIds = new Set<number>();

  for (const credit of credits) {
    if (
      credit.plaid_category_primary !== "TRANSFER_IN" ||
      credit.split ||
      !merchantIdentity(credit)
    ) {
      continue;
    }
    const creditCents = amountCents(credit.amount);
    const candidates = debits.filter(
      (debit) =>
        !debit.split &&
        !unavailableDebitIds.has(debit.id) &&
        !tentativelyUsedDebitIds.has(debit.id) &&
        dateDistanceDays(debit.transaction_date, credit.transaction_date) <=
          REIMBURSEMENT_DATE_WINDOW_DAYS &&
        Math.abs(amountCents(debit.amount) - creditCents * 2) <=
          REIMBURSEMENT_AMOUNT_TOLERANCE_CENTS,
    );
    const debit = closestDebit(credit, candidates);
    if (!debit) continue;
    tentative.push({ credit, debit });
    tentativelyUsedDebitIds.add(debit.id);
  }

  const groups = new Map<string, MatchedCredit[]>();
  for (const pair of tentative) {
    const key = [
      merchantIdentity(pair.credit),
      pair.debit.issuer,
      pair.debit.account_last_four,
      pair.debit.category,
      pair.debit.plaid_category_primary,
      amountCents(pair.debit.amount),
    ].join("\0");
    groups.set(key, [...(groups.get(key) || []), pair]);
  }

  return Array.from(groups.values()).flatMap((pairs) => {
    const months = new Set(
      pairs.map((pair) => pair.credit.transaction_date.slice(0, 7)),
    );
    return months.size >= MIN_RECURRING_MONTHS ? pairs : [];
  });
}

function operatingExpenseEffects(
  transactions: CategorizedExpenseTransaction[],
) {
  const capitalIds = capitalLoanPaymentIds(transactions);
  const debits = transactions.filter(
    (transaction) =>
      isBaseEligible(transaction) &&
      isDebit(transaction) &&
      !capitalIds.has(transaction.id),
  );
  const debitById = new Map(debits.map((transaction) => [transaction.id, transaction]));
  const remainingDebitCents = new Map(
    debits.map((transaction) => [transaction.id, effectiveCents(transaction)]),
  );
  const effects: ExpenseEffect[] = debits.map((transaction) => ({
    category: transaction.category,
    cents: effectiveCents(transaction),
    transactionDate: transaction.transaction_date,
  }));
  const credits = transactions
    .filter(
      (transaction) =>
        isBaseEligible(transaction) && transaction.transaction_type === "credit",
    )
    .sort(
      (left, right) =>
        left.transaction_date.localeCompare(right.transaction_date) ||
        left.id - right.id,
    );
  const consumedCreditIds = new Set<number>();
  const adjustedDebitIds = new Set<number>();

  function applyCredit(
    credit: CategorizedExpenseTransaction,
    debit: CategorizedExpenseTransaction,
    creditCents: number,
  ) {
    const remaining = remainingDebitCents.get(debit.id) || 0;
    const applied = Math.min(remaining, creditCents);
    if (!applied) return false;
    remainingDebitCents.set(debit.id, remaining - applied);
    consumedCreditIds.add(credit.id);
    adjustedDebitIds.add(debit.id);
    effects.push({
      category: debit.category,
      cents: -applied,
      transactionDate: credit.transaction_date,
    });
    return true;
  }

  // A relationship is a user-confirmed refund or reimbursement. Flow metadata
  // determines whether a split would otherwise apply twice.
  for (const credit of credits) {
    const debit = closestDebit(
      credit,
      (credit.related_transaction_ids || [])
        .map((id) => debitById.get(id))
        .filter((transaction): transaction is CategorizedExpenseTransaction =>
          Boolean(transaction),
        ),
    );
    if (!debit) continue;
    if (credit.plaid_category_primary === "TRANSFER_IN" && debit.split) continue;
    const creditCents =
      debit.split || credit.split
        ? Math.round(amountCents(credit.amount) / 2)
        : amountCents(credit.amount);
    applyCredit(credit, debit, creditCents);
  }

  // Merchant credits only offset a known purchase from the same account and
  // merchant. Generic transfers and income never become refunds implicitly.
  for (const credit of credits) {
    if (
      consumedCreditIds.has(credit.id) ||
      ["TRANSFER_IN", "INCOME"].includes(credit.plaid_category_primary)
    ) {
      continue;
    }
    const candidates = debits.filter((debit) => {
      if (
        debit.issuer !== credit.issuer ||
        debit.account_last_four !== credit.account_last_four ||
        debit.category !== credit.category ||
        debit.transaction_date > credit.transaction_date ||
        dateDistanceDays(debit.transaction_date, credit.transaction_date) >
          REFUND_LOOKBACK_DAYS ||
        !remainingDebitCents.get(debit.id)
      ) {
        return false;
      }
      return sameMerchant(credit, debit);
    });
    let remainingCredit = effectiveCents(credit);
    for (const debit of [...candidates].sort(
      (left, right) =>
        dateDistanceDays(left.transaction_date, credit.transaction_date) -
          dateDistanceDays(right.transaction_date, credit.transaction_date) ||
        right.transaction_date.localeCompare(left.transaction_date) ||
        left.id - right.id,
    )) {
      const remainingDebit = remainingDebitCents.get(debit.id) || 0;
      const applied = Math.min(remainingDebit, remainingCredit);
      if (!applied) continue;
      remainingDebitCents.set(debit.id, remainingDebit - applied);
      adjustedDebitIds.add(debit.id);
      effects.push({
        category: debit.category,
        cents: -applied,
        transactionDate: credit.transaction_date,
      });
      remainingCredit -= applied;
      if (!remainingCredit) break;
    }
    if (remainingCredit < effectiveCents(credit)) {
      consumedCreditIds.add(credit.id);
    } else if (Number(credit.amount) < 0) {
      // Statement imports can encode an unmistakable card credit as a negative
      // amount even when the original purchase descriptor is unavailable.
      consumedCreditIds.add(credit.id);
      effects.push({
        category: credit.category,
        cents: -effectiveCents(credit),
        transactionDate: credit.transaction_date,
      });
    }
  }

  const reimbursementPairs = recurringReimbursementPairs(
    credits.filter((credit) => !consumedCreditIds.has(credit.id)),
    debits,
    adjustedDebitIds,
  );
  for (const { credit, debit } of reimbursementPairs) {
    if (consumedCreditIds.has(credit.id) || adjustedDebitIds.has(debit.id)) continue;
    applyCredit(credit, debit, amountCents(credit.amount));
  }

  return effects;
}

export function isCategorizedExpense(transaction: CategorizedExpenseTransaction) {
  return isBaseEligible(transaction) && isDebit(transaction);
}

export function effectiveCategorizedExpenseAmount(
  transaction: CategorizedExpenseTransaction,
) {
  return effectiveCents(transaction) / 100;
}

export function categorizedExpenseAverages(
  transactions: CategorizedExpenseTransaction[],
  dateRange: ExpenseDateRange,
  today: string,
  category?: string,
  supplementalExpenses: SupplementalCategorizedExpense[] = [],
): ExpenseAverages {
  const effectiveEnd = dateRange.end < today ? dateRange.end : today;
  const transactionTotalCents = operatingExpenseEffects(transactions)
    .filter(
      (effect) =>
        effect.transactionDate >= dateRange.start &&
        effect.transactionDate <= effectiveEnd &&
        (!category || effect.category === category),
    )
    .reduce((sum, effect) => sum + effect.cents, 0);
  const supplementalTotalCents = supplementalExpenses
    .filter(
      (expense) =>
        expense.incurred_on >= dateRange.start &&
        expense.incurred_on <= effectiveEnd &&
        (!category || expense.category === category),
    )
    .reduce((sum, expense) => sum + amountCents(expense.amount), 0);
  const total = (transactionTotalCents + supplementalTotalCents) / 100;
  const days = calendarDays(dateRange.start, effectiveEnd);
  const daily = days ? Math.max(0, total) / days : 0;

  return {
    total,
    daily,
    weekly: daily * 7,
    monthly: daily * AVERAGE_DAYS_PER_MONTH,
  };
}

export function categorizedExpenseCategories(
  transactions: CategorizedExpenseTransaction[],
  dateRange: ExpenseDateRange,
  today: string,
  supplementalExpenses: SupplementalCategorizedExpense[] = [],
) {
  const effectiveEnd = dateRange.end < today ? dateRange.end : today;
  return Array.from(
    new Set(
      [
        ...operatingExpenseEffects(transactions)
          .filter(
            (effect) =>
              effect.transactionDate >= dateRange.start &&
              effect.transactionDate <= effectiveEnd &&
              effect.cents !== 0,
          )
          .map((effect) => effect.category),
        ...supplementalExpenses
          .filter(
            (expense) =>
              expense.incurred_on >= dateRange.start &&
              expense.incurred_on <= effectiveEnd,
          )
          .map((expense) => expense.category),
      ],
    ),
  ).sort((left, right) => left.localeCompare(right));
}
