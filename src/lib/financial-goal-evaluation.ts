import {
  calculateAdjustedAccountBalances,
  type TransactionStatusMode,
} from "./adjusted-account-balances";
import { transactionAccountFilters } from "./account-transaction-filters";
import type {
  CreditCardTransaction,
  PendingCardTransaction,
} from "./credit-card-transaction-types";
import type {
  FinancialGoal,
  FinancialGoalCondition,
  FinancialGoalInput,
} from "./financial-goal-types";
import { getCurrentPayPeriod, localPaydayString } from "./pay-cycle";
import type { PendingTransaction } from "./pending-transaction-types";
import type { BankValueSnapshot, SnapshotAccountKey } from "./snapshot-types";
import { selectTransactions } from "./transaction-selector";

const snapshotAccountKeys: SnapshotAccountKey[] = [
  "chase_checking",
  "chase_savings",
  "chase_credit",
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
    is_active: goal.is_active,
  };
}

function periodRange(value: string, currentDate: Date) {
  if (value === "current") {
    const period = getCurrentPayPeriod(currentDate);
    return {
      start: localPaydayString(period.start),
      end: localPaydayString(period.end),
    };
  }
  const match = value.match(payPeriodRangePattern);
  return match ? { start: match[1], end: match[2] } : null;
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
  if (keys.includes("citi_current")) keys.push("citi_pending");
  return Array.from(new Set(keys));
}

function accountBalance(
  goal: FinancialGoalInput,
  snapshot: BankValueSnapshot | null,
  pendingTransactions: PendingTransaction[],
  pendingCardTransactions: PendingCardTransaction[],
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

  return selectedAccountKeys(goal, snapshot).reduce((total, key) => {
    if (status === "posted") {
      return key === "citi_pending" ? total : total + postedValue(key);
    }
    if (status === "pending") {
      return (
        total +
        (key === "citi_pending" ? postedValue(key) : pendingValue(key))
      );
    }
    return total + adjustedValue(key);
  }, 0);
}

export function evaluateFinancialGoal({
  goal,
  transactions,
  snapshot,
  pendingTransactions = [],
  pendingCardTransactions = transactions,
  currentDate = new Date(),
}: {
  goal: FinancialGoalInput;
  transactions: CreditCardTransaction[];
  snapshot: BankValueSnapshot | null;
  pendingTransactions?: PendingTransaction[];
  pendingCardTransactions?: PendingCardTransaction[];
  currentDate?: Date;
}) {
  const scopeMatches = selectTransactions(
    transactions,
    goal.scope_conditions,
    "and",
    currentDate,
  );
  const periodCondition = goal.success_conditions.find(
    (condition) => condition.field === "spending_period",
  );
  const range = periodCondition
    ? periodRange(periodCondition.value, currentDate)
    : null;
  const spendingMatches = range
    ? scopeMatches.filter(
        (transaction) =>
          transaction.transaction_date >= range.start &&
          transaction.transaction_date <= range.end,
      )
    : scopeMatches;
  const spending = spendingMatches.reduce(
    (total, transaction) => total + Math.abs(Number(transaction.amount) || 0),
    0,
  );
  const balance = accountBalance(
    goal,
    snapshot,
    pendingTransactions,
    pendingCardTransactions,
  );

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
      const actual = condition.field === "account_balance" ? balance : spending;
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

  return {
    conditions,
    met,
    matchingTransactions: spendingMatches,
    selectedAccountBalance: balance,
    spending,
  };
}
