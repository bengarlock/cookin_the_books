"use client";

import { useMemo, useState, type FormEvent } from "react";

import {
  AutomationSelectorBuilder,
  PayPeriodSelector,
} from "@/components/automation-selector-builder";
import { useLiveSnapshot } from "@/components/live-snapshot-provider";
import { accountSelectorOptions } from "@/lib/account-transaction-filters";
import type { BudgetPlanSettings } from "@/lib/budget-plan-settings-types";
import { APP_BASE_PATH } from "@/lib/config";
import type { TransactionSelectorRecord } from "@/lib/credit-card-transaction-types";
import type { ExpenseAutomationCondition } from "@/lib/expense-automation-rule-types";
import {
  evaluateFinancialGoal,
  normalizeFinancialGoal,
  type EvaluatedGoalCondition,
} from "@/lib/financial-goal-evaluation";
import {
  hasSelectedGoalAccounts,
  normalizeGoalScopeConditions,
} from "@/lib/financial-goal-scope";
import { financialGoalDeleteAction } from "@/lib/financial-goal-actions";
import type {
  FinancialGoal,
  FinancialGoalCondition,
  FinancialGoalInput,
  FinancialGoalTrackingMetric,
} from "@/lib/financial-goal-types";
import type { IncomeEntry } from "@/lib/income-entry-types";
import type { PendingTransaction } from "@/lib/pending-transaction-types";
import { classifyPaychecks } from "@/lib/projections";
import { getNextPayCycle } from "@/lib/pay-cycle";
import { conditionIsEmpty, selectTransactions } from "@/lib/transaction-selector";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const goalFields = [
  { field: "account_balance", label: "Account balance" },
  { field: "current_balances", label: "Current Balances" },
  { field: "spending", label: "Spending" },
  { field: "spending_period", label: "Spending period" },
] as const;

const comparisonOperators = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
] as const;

const operatorLabels: Record<FinancialGoalCondition["operator"], string> = {
  equals: "Equals",
  not_equals: "Does not equal",
  greater_than: "Is greater than",
  greater_than_or_equal: "Is at least",
  less_than: "Is less than",
  less_than_or_equal: "Is at most",
  within: "Is within",
  not_within: "Is not within",
};

const fieldLabels: Record<FinancialGoalCondition["field"], string> = {
  account_balance: "Account balance",
  current_balances: "Current Balances",
  spending: "Spending",
  spending_period: "Spending period",
};

const trackingOptions: {
  metric: FinancialGoalTrackingMetric;
  label: string;
  description: string;
}[] = [
  {
    metric: "days_left_in_pay_cycle",
    label: "Days left in pay cycle",
    description: "Count down to the end of the selected pay period.",
  },
  {
    metric: "daily_spending_limit",
    label: "Daily spending limit",
    description: "Spread the remaining budget across the days left.",
  },
  {
    metric: "remaining_budget",
    label: "Remaining budget",
    description: "Subtract current spending from the spending target.",
  },
  {
    metric: "total_budget",
    label: "Total Budget",
    description: "Monitor the full spending target set for this goal.",
  },
  {
    metric: "projected_savings",
    label: "Projected Savings",
    description:
      "Compare the spending target with the next projected paycheck.",
  },
  {
    metric: "total_credit_card_spend",
    label: "Total Credit Card Spend",
    description:
      "Track posted and pending card balances for this goal's selected accounts.",
  },
];

function emptyGoal(): FinancialGoalInput {
  return {
    goal_type: "flexible",
    name: "",
    scope_conditions: [],
    success_conditions: [],
    tracking_metrics: [],
    is_active: true,
  };
}

function cloneGoalInput(goal: FinancialGoalInput): FinancialGoalInput {
  return {
    ...goal,
    scope_conditions: goal.scope_conditions.map((condition) => ({
      ...condition,
      value: Array.isArray(condition.value)
        ? [...condition.value]
        : condition.value,
    })),
    success_conditions: goal.success_conditions.map((condition) => ({
      ...condition,
    })),
    tracking_metrics: [...goal.tracking_metrics],
  };
}

function defaultGoalCondition(
  field: FinancialGoalCondition["field"],
  hasPrevious: boolean,
): FinancialGoalCondition {
  return {
    id: crypto.randomUUID(),
    field,
    operator: field === "spending_period" ? "within" : "less_than_or_equal",
    value: field === "spending_period" ? "current" : "",
    logic_operator: hasPrevious ? "and" : undefined,
  };
}

function goalIsComplete(goal: FinancialGoalInput) {
  return Boolean(
    goal.name.trim() &&
      goal.scope_conditions.length &&
      !goal.scope_conditions.some(conditionIsEmpty) &&
      goal.success_conditions.length &&
      !goal.success_conditions.some((condition) => !condition.value.trim()),
  );
}

async function responseMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { message?: string; detail?: string }
    | null;
  return (
    body?.message ||
    body?.detail ||
    "The financial goal could not be saved."
  );
}

function GoalConditionBuilder({
  conditions,
  onChange,
}: {
  conditions: FinancialGoalCondition[];
  onChange: (conditions: FinancialGoalCondition[]) => void;
}) {
  const [search, setSearch] = useState("");

  function add(field: FinancialGoalCondition["field"]) {
    onChange([...conditions, defaultGoalCondition(field, Boolean(conditions.length))]);
  }

  function update(id: string, patch: Partial<FinancialGoalCondition>) {
    onChange(
      conditions.map((condition) =>
        condition.id === id ? { ...condition, ...patch } : condition,
      ),
    );
  }

  function changeField(
    condition: FinancialGoalCondition,
    field: FinancialGoalCondition["field"],
  ) {
    const next = defaultGoalCondition(field, Boolean(condition.logic_operator));
    update(condition.id, {
      field,
      operator: next.operator,
      value: next.value,
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-h-64 rounded-2xl border border-dashed border-white/15 bg-black/10 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          Success criteria
        </p>
        {conditions.length ? (
          <div className="space-y-3">
            {conditions.map((condition, index) => {
              const operators =
                condition.field === "spending_period"
                  ? (["within", "not_within"] as const)
                  : comparisonOperators;
              return (
                <div
                  className="rounded-xl border border-white/10 bg-white/[0.035] p-3"
                  key={condition.id}
                >
                  {index ? (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                        Combine with previous row
                      </span>
                      <div className="flex rounded-lg border border-white/10 p-1">
                        {(["and", "or"] as const).map((connector) => (
                          <button
                            aria-pressed={
                              (condition.logic_operator || "and") === connector
                            }
                            className={`rounded px-2.5 py-1 text-[10px] font-semibold uppercase ${
                              (condition.logic_operator || "and") === connector
                                ? "bg-accent/15 text-accent"
                                : "text-muted"
                            }`}
                            key={connector}
                            onClick={() =>
                              update(condition.id, {
                                logic_operator: connector,
                              })
                            }
                            type="button"
                          >
                            {connector}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="grid items-center gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_auto]">
                    <select
                      className="min-w-0 w-full rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-sm text-white"
                      onChange={(event) =>
                        changeField(
                          condition,
                          event.target.value as FinancialGoalCondition["field"],
                        )
                      }
                      value={condition.field}
                    >
                      {goalFields.map((item) => (
                        <option key={item.field} value={item.field}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="min-w-0 w-full rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-xs text-white"
                      onChange={(event) =>
                        update(condition.id, {
                          operator: event.target
                            .value as FinancialGoalCondition["operator"],
                        })
                      }
                      value={condition.operator}
                    >
                      {operators.map((operator) => (
                        <option key={operator} value={operator}>
                          {operatorLabels[operator]}
                        </option>
                      ))}
                    </select>
                    {condition.field === "spending_period" ? (
                      <div className="min-w-0 [&>select]:w-full">
                        <PayPeriodSelector
                          onChange={(value) => update(condition.id, { value })}
                          value={condition.value}
                        />
                      </div>
                    ) : (
                      <div className="relative min-w-0">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
                          $
                        </span>
                        <input
                          className="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-7 pr-3 text-sm text-white outline-none focus:border-accent/40"
                          inputMode="decimal"
                          min="0"
                          onChange={(event) =>
                            update(condition.id, { value: event.target.value })
                          }
                          placeholder="0.00"
                          step="0.01"
                          type="number"
                          value={condition.value}
                        />
                      </div>
                    )}
                    <button
                      aria-label={`Remove ${fieldLabels[condition.field]}`}
                      className="justify-self-end px-2 text-lg text-white/35 hover:text-rose-200"
                      onClick={() =>
                        onChange(
                          conditions.filter((item) => item.id !== condition.id),
                        )
                      }
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-44 place-items-center rounded-xl border border-white/[0.06] px-6 text-center text-sm text-muted">
            Choose a condition to define what success looks like.
          </div>
        )}
      </div>
      <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold">
          Conditions
        </p>
        <input
          className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search conditions"
          value={search}
        />
        <div className="mt-3 space-y-1">
          {goalFields
            .filter((item) =>
              item.label.toLowerCase().includes(search.toLowerCase()),
            )
            .map((item) => (
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/70 transition hover:bg-accent/10 hover:text-accent"
                key={item.field}
                onClick={() => add(item.field)}
                type="button"
              >
                <span className="text-accent">＋</span>
                {item.label}
              </button>
            ))}
        </div>
      </aside>
    </div>
  );
}

function GoalFields({
  value,
  transactions,
  onChange,
}: {
  value: FinancialGoalInput;
  transactions: TransactionSelectorRecord[];
  onChange: (value: FinancialGoalInput) => void;
}) {
  const accounts = useMemo(
    () => accountSelectorOptions(transactions),
    [transactions],
  );
  const descriptions = useMemo(
    () =>
      Array.from(
        new Set(transactions.map((item) => item.description).filter(Boolean)),
      ).sort(),
    [transactions],
  );
  const tags = useMemo(
    () =>
      Array.from(
        new Set(
          transactions.flatMap(
            (item) => item.tags?.map((tag) => tag.name) || [],
          ),
        ),
      ).sort(),
    [transactions],
  );
  const preview = useMemo(
    () => selectTransactions(transactions, value.scope_conditions, "and"),
    [transactions, value.scope_conditions],
  );
  const hasSelectedAccounts = hasSelectedGoalAccounts(value.scope_conditions);
  const payPeriodCondition = value.scope_conditions.find(
    (condition) =>
      condition.field === "pay_period" && condition.operator === "equals",
  );

  function updateScopeConditions(
    scopeConditions: ExpenseAutomationCondition[],
  ) {
    onChange({
      ...value,
      scope_conditions: normalizeGoalScopeConditions(scopeConditions),
    });
  }

  function setIncludeOutstandingPending(include: boolean) {
    if (!payPeriodCondition) return;
    updateScopeConditions(
      value.scope_conditions.map((condition) =>
        condition.id === payPeriodCondition.id
          ? {
              ...condition,
              include_outstanding_pending: include || undefined,
            }
          : condition,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        Goal name
        <input
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent/40"
          maxLength={100}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          placeholder="Keep Citi spending and balance under control"
          required
          value={value.name}
        />
      </label>

      <section>
        <div className="mb-4 flex gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent/10 text-xs font-semibold text-accent">
            1
          </span>
          <div>
            <h4 className="font-semibold text-white">Frame the goal</h4>
            <p className="mt-1 text-sm text-muted">
              Select the accounts, transactions, tags, or time window this goal
              should watch.
            </p>
          </div>
        </div>
        <AutomationSelectorBuilder
          accounts={accounts}
          conditions={value.scope_conditions}
          descriptions={descriptions}
          includeTransactionStatus
          logic="and"
          matches={preview}
          onChange={updateScopeConditions}
          renderConditionFooter={(condition) =>
            hasSelectedAccounts &&
            condition.id === payPeriodCondition?.id ? (
              <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-white/10 pt-3">
                <input
                  checked={
                    condition.include_outstanding_pending === true
                  }
                  className="mt-0.5"
                  onChange={(event) =>
                    setIncludeOutstandingPending(event.target.checked)
                  }
                  type="checkbox"
                />
                <span>
                  <span className="block text-xs font-semibold text-sky-100">
                    Include outstanding pending charges
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-sky-100/55">
                    Also count pending purchases, fees, and interest on the
                    selected accounts when dated outside this pay period.
                  </span>
                </span>
              </label>
            ) : null
          }
          tags={tags}
        />
      </section>

      <section className="border-t border-white/10 pt-6">
        <div className="mb-4 flex gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-gold/30 bg-gold/10 text-xs font-semibold text-gold">
            2
          </span>
          <div>
            <h4 className="font-semibold text-white">Define success</h4>
            <p className="mt-1 text-sm text-muted">
              Add one or more measurable conditions. Mix balance and spending
              targets with a rolling pay-period window.
            </p>
          </div>
        </div>
        <GoalConditionBuilder
          conditions={value.success_conditions}
          onChange={(success_conditions) =>
            onChange({ ...value, success_conditions })
          }
        />
      </section>

      <section className="border-t border-white/10 pt-6">
        <div className="mb-4 flex gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-sky-300/30 bg-sky-400/10 text-xs font-semibold text-sky-200">
            3
          </span>
          <div>
            <h4 className="font-semibold text-white">Tracking</h4>
            <p className="mt-1 text-sm text-muted">
              Choose the live values you want this goal to monitor. Select as
              many as you need.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {trackingOptions.map((option) => {
            const selected = value.tracking_metrics.includes(option.metric);
            return (
              <button
                aria-pressed={selected}
                className={`rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-sky-300/35 bg-sky-400/10 text-white"
                    : "border-white/10 bg-black/10 text-white/70 hover:border-sky-300/25"
                }`}
                key={option.metric}
                onClick={() =>
                  onChange({
                    ...value,
                    tracking_metrics: selected
                      ? value.tracking_metrics.filter(
                          (metric) => metric !== option.metric,
                        )
                      : [...value.tracking_metrics, option.metric],
                  })
                }
                type="button"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded border text-xs ${
                      selected
                        ? "border-sky-300/50 bg-sky-300 text-[#07100f]"
                        : "border-white/20"
                    }`}
                  >
                    {selected ? "✓" : ""}
                  </span>
                </span>
                <span className="mt-2 block text-xs leading-5 text-muted">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <label className="flex items-center gap-2 border-t border-white/10 pt-5 text-sm text-white/70">
        <input
          checked={value.is_active}
          onChange={(event) =>
            onChange({ ...value, is_active: event.target.checked })
          }
          type="checkbox"
        />
        Start tracking this goal immediately
      </label>
    </div>
  );
}

function scopeSummary(
  conditions: ExpenseAutomationCondition[],
  accountLabels: Map<string, string>,
) {
  return conditions.map((condition) => {
    const values = Array.isArray(condition.value)
      ? condition.value
      : [condition.value];
    if (condition.field === "account_last_four") {
      return values.map((value) => accountLabels.get(value) || `•••• ${value}`).join(", ");
    }
    if (condition.field === "pay_period") {
      const period =
        values[0] === "current" ? "Current Pay Period" : "Fixed pay period";
      return condition.operator === "equals" &&
        condition.include_outstanding_pending
        ? `${period} + outstanding pending charges`
        : period;
    }
    if (condition.field === "transaction_status") {
      return values[0] === "posted"
        ? "Posted only"
        : values[0] === "pending"
          ? "Pending only"
          : "Posted + pending";
    }
    const label = condition.field.replaceAll("_", " ");
    return `${label}: ${values.join(", ")}`;
  });
}

function conditionTarget(condition: EvaluatedGoalCondition) {
  if (condition.field === "spending_period") {
    if (!condition.periodStart || !condition.periodEnd) return "Invalid period";
    return `${date.format(new Date(`${condition.periodStart}T12:00:00`))} – ${date.format(new Date(`${condition.periodEnd}T12:00:00`))}`;
  }
  return money.format(Number(condition.value));
}

function trackingMetricLabel(metric: FinancialGoalTrackingMetric) {
  return (
    trackingOptions.find((option) => option.metric === metric)?.label || metric
  );
}

function trackingMetricValue(
  metric: FinancialGoalTrackingMetric,
  value: number | null,
) {
  if (value === null) {
    return metric === "projected_savings"
      ? "Needs a spending target and paycheck history"
      : "Needs a spending target and pay period";
  }
  if (metric === "days_left_in_pay_cycle") {
    return `${value} ${value === 1 ? "day" : "days"}`;
  }
  return money.format(value);
}

export function FinancialGoals({
  initialBudgetPlanSettings,
  initialGoals,
  initialIncomeEntries,
  initialPendingTransactions,
  initialTransactions,
}: {
  initialBudgetPlanSettings: BudgetPlanSettings;
  initialGoals: FinancialGoal[];
  initialIncomeEntries: IncomeEntry[];
  initialPendingTransactions: PendingTransaction[];
  initialTransactions: TransactionSelectorRecord[];
}) {
  const { snapshot } = useLiveSnapshot();
  const projectedNextPaycheck = useMemo(() => {
    const currentDate = new Date();
    const payCycle = getNextPayCycle(
      currentDate,
      initialBudgetPlanSettings.next_payday_override,
    );
    const projection = classifyPaychecks(
      initialIncomeEntries,
      currentDate,
      payCycle.nextPayday,
    );
    return projection.normalPaychecks.length
      ? projection.predictedNetPay
      : null;
  }, [initialBudgetPlanSettings.next_payday_override, initialIncomeEntries]);
  const [goals, setGoals] = useState(initialGoals);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<FinancialGoalInput>(emptyGoal);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<FinancialGoalInput>(emptyGoal);
  const [saving, setSaving] = useState(false);
  const [pinningId, setPinningId] = useState<number | null>(null);
  const [pinningTrackingKey, setPinningTrackingKey] = useState<string | null>(
    null,
  );
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const accountLabels = useMemo(
    () =>
      new Map(
        accountSelectorOptions(initialTransactions).map((account) => [
          account.value,
          account.label,
        ]),
      ),
    [initialTransactions],
  );

  async function createGoal(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/financial-goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        setError(await responseMessage(response));
        return;
      }
      const goal = (await response.json()) as FinancialGoal;
      setGoals((current) => [goal, ...current]);
      setDraft(emptyGoal());
      setCreating(false);
    } catch {
      setError("The financial goal service is currently unavailable.");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(goal: FinancialGoal) {
    setEditingId(goal.id);
    setEditDraft(cloneGoalInput(normalizeFinancialGoal(goal)));
    setCreating(false);
    setConfirmingDeleteId(null);
    setError("");
  }

  async function updateGoal(event: FormEvent) {
    event.preventDefault();
    if (editingId === null) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/financial-goals/${editingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editDraft),
        },
      );
      if (!response.ok) {
        setError(await responseMessage(response));
        return;
      }
      const goal = (await response.json()) as FinancialGoal;
      setGoals((current) =>
        current.map((item) => (item.id === goal.id ? goal : item)),
      );
      setEditingId(null);
    } catch {
      setError("The financial goal service is currently unavailable.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePinned(goal: FinancialGoal) {
    setPinningId(goal.id);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/financial-goals/${goal.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_pinned: !goal.is_pinned }),
        },
      );
      if (!response.ok) {
        setError(await responseMessage(response));
        return;
      }
      const updatedGoal = (await response.json()) as FinancialGoal;
      setGoals((current) =>
        current.map((item) =>
          item.id === updatedGoal.id ? updatedGoal : item,
        ),
      );
    } catch {
      setError("The financial goal service is currently unavailable.");
    } finally {
      setPinningId(null);
    }
  }

  async function toggleTrackingPinned(
    goal: FinancialGoal,
    metric: FinancialGoalTrackingMetric,
  ) {
    const key = `${goal.id}-${metric}`;
    const pinnedMetrics = goal.pinned_tracking_metrics || [];
    const isPinned = pinnedMetrics.includes(metric);
    const nextPinnedMetrics = isPinned
      ? pinnedMetrics.filter((item) => item !== metric)
      : [...pinnedMetrics, metric];
    setPinningTrackingKey(key);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/financial-goals/${goal.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pinned_tracking_metrics: nextPinnedMetrics,
          }),
        },
      );
      if (!response.ok) {
        setError(await responseMessage(response));
        return;
      }
      const updatedGoal = (await response.json()) as FinancialGoal;
      setGoals((current) =>
        current.map((item) =>
          item.id === updatedGoal.id ? updatedGoal : item,
        ),
      );
    } catch {
      setError("The financial goal service is currently unavailable.");
    } finally {
      setPinningTrackingKey(null);
    }
  }

  async function deleteGoal(goal: FinancialGoal) {
    setDeletingId(goal.id);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/financial-goals/${goal.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setError(await responseMessage(response));
        return;
      }
      setGoals((current) => current.filter((item) => item.id !== goal.id));
      setConfirmingDeleteId(null);
    } catch {
      setError("The financial goal service is currently unavailable.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleDeleteClick(goal: FinancialGoal) {
    if (
      financialGoalDeleteAction(confirmingDeleteId, goal.id) === "confirm"
    ) {
      setConfirmingDeleteId(goal.id);
      return;
    }

    void deleteGoal(goal);
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Financial goals
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Build goals around what matters
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Choose what the goal watches, then define the balance, spending, and
            timing conditions that mean success.
          </p>
        </div>
        {!creating ? (
          <button
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#07100f] transition hover:bg-[#7aebbd]"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
              setDraft(emptyGoal());
              setError("");
            }}
            type="button"
          >
            Create goal
          </button>
        ) : null}
      </div>

      {error && !creating && editingId === null ? (
        <p
          className="rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {creating ? (
        <form className="surface rounded-2xl p-5 sm:p-6" onSubmit={createGoal}>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              New flexible goal
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Set the scope, then set the conditions
            </h3>
          </div>
          <GoalFields
            onChange={setDraft}
            transactions={initialTransactions}
            value={draft}
          />
          {error ? (
            <p className="mt-4 text-sm text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex gap-3 border-t border-white/10 pt-5">
            <button
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[#07100f] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={saving || !goalIsComplete(draft)}
              type="submit"
            >
              {saving ? "Saving…" : "Save goal"}
            </button>
            <button
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-muted"
              onClick={() => setCreating(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4">
        {goals.map((goal) => {
          const normalized = normalizeFinancialGoal(goal);
          const evaluation = evaluateFinancialGoal({
            goal: normalized,
            pendingTransactions: initialPendingTransactions,
            projectedNextPaycheck,
            transactions: initialTransactions,
            snapshot,
          });
          const summaries = scopeSummary(
            normalized.scope_conditions,
            accountLabels,
          );

          return editingId === goal.id ? (
            <form
              className="surface rounded-2xl p-5 sm:p-6"
              key={goal.id}
              onSubmit={updateGoal}
            >
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
                  Edit goal
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  Refine the scope or success conditions
                </h3>
              </div>
              <GoalFields
                onChange={setEditDraft}
                transactions={initialTransactions}
                value={editDraft}
              />
              {error ? (
                <p className="mt-4 text-sm text-rose-300" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="mt-6 flex gap-3 border-t border-white/10 pt-5">
                <button
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[#07100f] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={saving || !goalIsComplete(editDraft)}
                  type="submit"
                >
                  {saving ? "Saving…" : "Update goal"}
                </button>
                <button
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-muted"
                  onClick={() => setEditingId(null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <article className="surface overflow-hidden rounded-2xl" key={goal.id}>
              <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white">{goal.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        goal.is_active
                          ? evaluation.met
                            ? "bg-accent/10 text-accent"
                            : "bg-gold/10 text-gold"
                          : "bg-white/5 text-muted"
                      }`}
                    >
                      {!goal.is_active
                        ? "Paused"
                        : evaluation.met
                          ? "Conditions met"
                          : "In progress"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {summaries.map((summary) => (
                      <span
                        className="rounded-full border border-sky-300/15 bg-sky-400/[0.06] px-2.5 py-1 text-[11px] text-sky-100/75"
                        key={summary}
                      >
                        {summary}
                      </span>
                    ))}
                    {evaluation.carriedPendingTransactions.length ? (
                      <span className="rounded-full border border-gold/20 bg-gold/[0.07] px-2.5 py-1 text-[11px] text-gold">
                        Includes{" "}
                        {evaluation.carriedPendingTransactions.length} pending{" "}
                        {evaluation.carriedPendingTransactions.length === 1
                          ? "charge"
                          : "charges"}{" "}
                        from outside this pay period
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-pressed={goal.is_pinned}
                    className={`inline-flex min-w-24 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-50 ${
                      goal.is_pinned
                        ? "border-gold/30 bg-gold/10 text-gold"
                        : "border-white/10 text-white/70 hover:border-gold/25 hover:text-gold"
                    }`}
                    disabled={pinningId === goal.id}
                    onClick={() => void togglePinned(goal)}
                    title={
                      goal.is_pinned
                        ? "Remove from Overview"
                        : "Pin to Overview"
                    }
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="size-4"
                      fill={goal.is_pinned ? "currentColor" : "none"}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="m8 4 8 0-1 5 3 3v1H6v-1l3-3-1-5Zm4 9v7"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.7"
                      />
                    </svg>
                    {pinningId === goal.id
                      ? "Saving…"
                      : goal.is_pinned
                        ? "Pinned"
                        : "Pin"}
                  </button>
                  <button
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/70 hover:border-accent/30 hover:text-accent"
                    onClick={() => beginEdit(goal)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    aria-label={
                      confirmingDeleteId === goal.id
                        ? `Confirm deletion of ${goal.name}`
                        : `Delete ${goal.name}`
                    }
                    className={`inline-flex min-w-24 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-50 ${
                      confirmingDeleteId === goal.id
                        ? "border-rose-300/40 bg-rose-500/20 text-rose-100"
                        : "border-rose-300/15 text-rose-300/80 hover:border-rose-300/35 hover:bg-rose-500/10 hover:text-rose-100"
                    }`}
                    disabled={deletingId === goal.id}
                    onClick={() => handleDeleteClick(goal)}
                    title={
                      confirmingDeleteId === goal.id
                        ? "Confirm goal deletion"
                        : "Delete goal"
                    }
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="size-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.7"
                      />
                    </svg>
                    {deletingId === goal.id
                      ? "Deleting…"
                      : confirmingDeleteId === goal.id
                        ? "Confirm"
                        : "Delete"}
                  </button>
                </div>
              </div>
              <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-3">
                {evaluation.conditions.map((condition) => (
                  <div className="bg-panel p-5" key={condition.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                          {fieldLabels[condition.field]}
                        </p>
                        <p className="mt-1 text-xs text-white/55">
                          {operatorLabels[condition.operator]}
                        </p>
                      </div>
                      <span
                        className={`size-2.5 rounded-full ${
                          condition.met ? "bg-accent" : "bg-gold"
                        }`}
                        title={condition.met ? "Condition met" : "In progress"}
                      />
                    </div>
                    <p className="mt-4 font-mono text-lg font-semibold text-white">
                      {conditionTarget(condition)}
                    </p>
                    {condition.actual !== null ? (
                      <p
                        className={`mt-1 text-sm ${
                          condition.met ? "text-accent" : "text-gold"
                        }`}
                      >
                        Current: {money.format(condition.actual)}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-accent">
                        {evaluation.matchingTransactions.length} matching{" "}
                        {evaluation.matchingTransactions.length === 1
                          ? "transaction"
                          : "transactions"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {evaluation.trackingMetrics.length ? (
                <div className="border-t border-white/10 bg-panel/70 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200/70">
                    Tracking
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {evaluation.trackingMetrics.map((item) => {
                      const pinKey = `${goal.id}-${item.metric}`;
                      const isPinned = (
                        goal.pinned_tracking_metrics || []
                      ).includes(item.metric);
                      return (
                        <div
                          className={`rounded-xl border p-4 transition ${
                            isPinned
                              ? "border-gold/30 bg-gold/[0.08]"
                              : "border-sky-300/15 bg-sky-400/[0.05]"
                          }`}
                          key={item.metric}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs text-muted">
                              {trackingMetricLabel(item.metric)}
                            </p>
                            <button
                              aria-label={`${isPinned ? "Unpin" : "Pin"} ${trackingMetricLabel(item.metric)} from Overview`}
                              aria-pressed={isPinned}
                              className={`grid size-8 shrink-0 place-items-center rounded-lg border transition disabled:cursor-wait disabled:opacity-50 ${
                                isPinned
                                  ? "border-gold/30 bg-gold/10 text-gold"
                                  : "border-white/10 text-white/45 hover:border-gold/25 hover:text-gold"
                              }`}
                              disabled={pinningTrackingKey === pinKey}
                              onClick={() =>
                                void toggleTrackingPinned(goal, item.metric)
                              }
                              title={
                                isPinned
                                  ? "Remove tracking tile from Overview"
                                  : "Pin tracking tile to Overview"
                              }
                              type="button"
                            >
                              <svg
                                aria-hidden="true"
                                className="size-4"
                                fill={isPinned ? "currentColor" : "none"}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  d="m8 4 8 0-1 5 3 3v1H6v-1l3-3-1-5Zm4 9v7"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="1.7"
                                />
                              </svg>
                            </button>
                          </div>
                          <p className="mt-2 font-mono text-lg font-semibold text-sky-100">
                            {trackingMetricValue(item.metric, item.value)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
        {!goals.length && !creating ? (
          <div className="surface rounded-2xl p-8 text-center">
            <p className="text-sm text-muted">
              No financial goals yet. Start by selecting what the goal should
              watch.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
