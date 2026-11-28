import {
  calculateAdjustedAccountBalances,
  liabilityAccountKeys,
  type TransactionStatusMode,
} from "./adjusted-account-balances";
import { transactionAccountFilters } from "./account-transaction-filters";
import type {
  PendingCardTransaction,
  TransactionSelectorRecord,
} from "./credit-card-transaction-types";
import type {
  FinancialGoal,
  FinancialGoalCondition,
  FinancialGoalInput,
  FinancialGoalTrackingMetric,
} from "./financial-goal-types";
import {
  getCurrentPayPeriod,
  localPaydayString,
  type PaydayOverrides,
} from "./pay-cycle";
import type { PendingTransaction } from "./pending-transaction-types";
import type { BankValueSnapshot, SnapshotAccountKey } from "./snapshot-types";
import { selectTransactions } from "./transaction-selector";

const snapshotAccountKeys: SnapshotAccountKey[] = [
  "chase_checking",
  "chase_savings",
  "chase_credit",
  "chase_credit_8506",
  "citi_current",
  "citi_pending",
  "barclays_card",
  "etrade",
  "betterment_general",
  "betterment_safety",
  "betterment_retirement",
  "fidelity_retirement",
];

const payPeriodRangePattern =
  /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

export type EvaluatedGoalCondition = FinancialGoalCondition & {
  actual: number | null;
  met: boolean;
  periodStart?: string;
  periodEnd?: string;
};

export type EvaluatedGoalTrackingMetric = {
  metric: FinancialGoalTrackingMetric;
  value: number | null;
};

export function normalizeFinancialGoal(goal: FinancialGoal): FinancialGoalInput {
  if (goal.scope_conditions?.length && goal.success_conditions?.length) {
    return {
      goal_type: "flexible",
      name: goal.name,
      scope_conditions: goal.scope_conditions.map((condition) => ({
        ...condition,
        value: Array.isArray(condition.value)
          ? [...condition.value]
          : condition.value,
      })),
      success_conditions: goal.success_conditions.map((condition) => ({
        ...condition,
      })),
      tracking_metrics: [...(goal.tracking_metrics || [])],
      is_active: goal.is_active,
    };
  }

  const periodValue =
    goal.period_mode === "current_pay_period"
      ? "current"
      : goal.pay_cycle_start && goal.pay_cycle_end
        ? `${goal.pay_cycle_start}..${goal.pay_cycle_end}`
        : "current";

  return {
    goal_type: "flexible",
    name: goal.name,
    scope_conditions: [
      {
        id: `legacy-scope-${goal.id}`,
        field: "pay_period",
        operator: "equals",
        value: periodValue,
      },
    ],
    success_conditions: [
      {
        id: `legacy-success-${goal.id}`,
        field: "spending",
        operator: "less_than_or_equal",
        value: goal.target_amount || "0",
      },
    ],
    tracking_metrics: [...(goal.tracking_metrics || [])],
    is_active: goal.is_active,
  };
}

function periodRange(
  value: string,
  currentDate: Date,
  paydayOverrides?: PaydayOverrides | null,
) {
  if (value === "current") {
    const period = getCurrentPayPeriod(currentDate, null, paydayOverrides);
    return {
      start: localPaydayString(period.start),
      end: localPaydayString(period.end),
    };
  }
  const match = value.match(payPeriodRangePattern);
  return match ? { start: match[1], end: match[2] } : null;
}

function selectedPeriodRange(
  goal: FinancialGoalInput,
  currentDate: Date,
  paydayOverrides?: PaydayOverrides | null,
) {
  const successPeriod = goal.success_conditions.find(
    (condition) => condition.field === "spending_period",
  );
  const scopePeriod = goal.scope_conditions.find(
    (condition) => condition.field === "pay_period",
  );
  const scopeValue = scopePeriod
    ? Array.isArray(scopePeriod.value)
      ? scopePeriod.value[0]
      : scopePeriod.value
    : null;
  return periodRange(
    successPeriod?.value || scopeValue || "",
    currentDate,
    paydayOverrides,
  );
}

function daysLeftInPeriod(periodEnd: string, currentDate: Date) {
  const today = Date.parse(`${localPaydayString(currentDate)}T00:00:00Z`);
  const end = Date.parse(`${periodEnd}T00:00:00Z`);
  return Math.max(0, Math.round((end - today) / 86_400_000));
}

function compare(actual: number, operator: FinancialGoalCondition["operator"], target: number) {
  if (operator === "equals") return Math.abs(actual - target) < 0.005;
  if (operator === "not_equals") return Math.abs(actual - target) >= 0.005;
  if (operator === "greater_than") return actual > target;
  if (operator === "greater_than_or_equal") return actual >= target;
  if (operator === "less_than") return actual < target;
  if (operator === "less_than_or_equal") return actual <= target;
  return false;
}

function selectedAccountKeys(
  goal: FinancialGoalInput,
  snapshot: BankValueSnapshot | null,
  transactions: TransactionSelectorRecord[],
) {
  const selectedLastFour = new Set(
    goal.scope_conditions
      .filter(
        (condition) =>
          condition.field === "account_last_four" &&
          condition.operator === "equals",
      )
      .flatMap((condition) =>
        Array.isArray(condition.value) ? condition.value : [condition.value],
      ),
  );

  if (!selectedLastFour.size) {
    return snapshot?.account_balances?.length
      ? snapshot.account_balances.map((account) => account.account_key)
      : snapshotAccountKeys;
  }

  const keys = Object.entries(transactionAccountFilters)
    .filter(([, filter]) => filter && selectedLastFour.has(filter.accountLastFour))
    .map(([key]) => key as SnapshotAccountKey);
  keys.push(...transactions
    .filter((transaction) =>
      selectedLastFour.has(transaction.account_last_four) && Boolean(transaction.account_key),
    )
    .map((transaction) => transaction.account_key as SnapshotAccountKey));
  if (keys.includes("citi_current")) keys.push("citi_pending");
  return Array.from(new Set(keys));
}

function selectedBalances(
  goal: FinancialGoalInput,
  snapshot: BankValueSnapshot | null,
  pendingTransactions: PendingTransaction[],
  pendingCardTransactions: PendingCardTransaction[],
  transactions: TransactionSelectorRecord[],
) {
  const { adjustedValue, pendingValue, postedValue } =
    calculateAdjustedAccountBalances({
      snapshot,
      pendingTransactions,
      pendingCardTransactions,
    });
  const statusCondition = goal.scope_conditions.find(
    (condition) => condition.field === "transaction_status",
  );
  const rawStatus = statusCondition
    ? Array.isArray(statusCondition.value)
      ? statusCondition.value[0]
      : statusCondition.value
    : "both";
  const status: TransactionStatusMode =
    rawStatus === "posted" || rawStatus === "pending" ? rawStatus : "both";

  const valueForKey = (key: SnapshotAccountKey) => {
    if (status === "posted") {
      return key === "citi_pending" ? 0 : postedValue(key);
    }
    if (status === "pending") {
      return key === "citi_pending" ? postedValue(key) : pendingValue(key);
    }
    return adjustedValue(key);
  };
  const keys = selectedAccountKeys(goal, snapshot, transactions);
  return {
    all: keys.reduce((total, key) => total + valueForKey(key), 0),
    liabilities: keys
      .filter((key) => liabilityAccountKeys.has(key))
      .reduce((total, key) => total + valueForKey(key), 0),
  };
}

export function evaluateFinancialGoal({
  goal,
  transactions,
  snapshot,
  pendingTransactions = [],
  pendingCardTransactions = transactions,
  currentDate = new Date(),
  projectedNextPaycheck = null,
  paydayOverrides = null,
}: {
  goal: FinancialGoalInput;
  transactions: TransactionSelectorRecord[];
  snapshot: BankValueSnapshot | null;
  pendingTransactions?: PendingTransaction[];
  pendingCardTransactions?: PendingCardTransaction[];
  currentDate?: Date;
  projectedNextPaycheck?: number | null;
  paydayOverrides?: PaydayOverrides | null;
}) {
  const scopeMatches = selectTransactions(
    transactions,
    goal.scope_conditions,
    "and",
    currentDate,
    paydayOverrides,
  );
  const includeOutstandingPending = goal.scope_conditions.some(
    (condition) =>
      condition.field === "pay_period" &&
      condition.operator === "equals" &&
      condition.include_outstanding_pending === true,
  );
  const range = selectedPeriodRange(goal, currentDate, paydayOverrides);
  const spendingMatches = range
    ? scopeMatches.filter(
        (transaction) =>
          (transaction.transaction_date >= range.start &&
            transaction.transaction_date <= range.end) ||
          (includeOutstandingPending && transaction.pending === true),
      )
    : scopeMatches;
  const carriedPendingTransactions =
    includeOutstandingPending && range
      ? spendingMatches.filter(
          (transaction) =>
            transaction.pending === true &&
            (transaction.transaction_date < range.start ||
              transaction.transaction_date > range.end),
        )
      : [];
  const spending = spendingMatches.reduce(
    (total, transaction) => total + Math.abs(Number(transaction.amount) || 0),
    0,
  );
  const balances = selectedBalances(
    goal,
    snapshot,
    pendingTransactions,
    pendingCardTransactions,
    transactions,
  );
  const balance = balances.all;

  const conditions: EvaluatedGoalCondition[] = goal.success_conditions.map(
    (condition) => {
      if (condition.field === "spending_period") {
        return {
          ...condition,
          actual: null,
          met: Boolean(range),
          periodStart: range?.start,
          periodEnd: range?.end,
        };
      }
      const actual =
        condition.field === "account_balance" ||
        condition.field === "current_balances"
          ? balance
          : spending;
      return {
        ...condition,
        actual,
        met: compare(actual, condition.operator, Number(condition.value)),
      };
    },
  );

  const met = conditions.reduce((result, condition, index) => {
    if (!index) return condition.met;
    return (condition.logic_operator || "and") === "or"
      ? result || condition.met
      : result && condition.met;
  }, false);
  const budgetCondition = goal.success_conditions.find(
    (condition) => condition.field === "spending",
  ) ?? goal.success_conditions.find(
    (condition) =>
      condition.field === "current_balances" ||
      condition.field === "account_balance",
  );
  const budgetTarget = budgetCondition
    ? Number(budgetCondition.value)
    : Number.NaN;
  const budgetActual = budgetCondition?.field === "spending"
    ? spending
    : balance;
  const remainingBudget = Number.isFinite(budgetTarget)
    ? budgetTarget - budgetActual
    : null;
  const daysLeft = range ? daysLeftInPeriod(range.end, currentDate) : null;
  const dailySpendingLimit =
    remainingBudget === null || daysLeft === null
      ? null
      : daysLeft > 0
        ? Math.max(0, remainingBudget) / daysLeft
        : 0;
  const trackingValues: Record<FinancialGoalTrackingMetric, number | null> = {
    days_left_in_pay_cycle: daysLeft,
    daily_spending_limit: dailySpendingLimit,
    remaining_budget: remainingBudget,
    total_budget: Number.isFinite(budgetTarget) ? budgetTarget : null,
    projected_savings:
      Number.isFinite(budgetTarget) && projectedNextPaycheck !== null
        ? projectedNextPaycheck - budgetTarget
        : null,
    total_credit_card_spend: balances.liabilities,
  };
  const trackingMetrics: EvaluatedGoalTrackingMetric[] =
    goal.tracking_metrics.map((metric) => ({
      metric,
      value: trackingValues[metric],
    }));

  return {
    conditions,
    carriedPendingTransactions,
    met,
    matchingTransactions: spendingMatches,
    selectedAccountBalance: balance,
    spending,
    trackingMetrics,
  };
}
