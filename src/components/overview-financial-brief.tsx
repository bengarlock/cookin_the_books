import Link from "next/link";
import type { ReactNode } from "react";

import { evaluateFinancialGoal, normalizeFinancialGoal } from "../lib/financial-goal-evaluation";
import type { FinancialGoal, FinancialGoalTrackingMetric } from "../lib/financial-goal-types";
import type { PendingCardTransaction, TransactionSelectorRecord } from "../lib/credit-card-transaction-types";
import type { PendingTransaction } from "../lib/pending-transaction-types";
import type { BankValueSnapshot } from "../lib/snapshot-types";
import { getCurrentPayPeriod, type PaydayOverrides } from "../lib/pay-cycle";

const labels: Record<FinancialGoalTrackingMetric, string> = {
  remaining_budget: "Remaining budget",
  daily_spending_limit: "Daily spending limit",
  days_left_in_pay_cycle: "Time remaining",
  total_budget: "Total budget",
  total_credit_card_spend: "Total credit card spend",
  projected_savings: "Projected savings",
};

export function overviewCurrency(value: number | string | null | undefined, whole = false) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2,
  }).format(Number(value));
}

type GoalContext = {
  currentDate: Date;
  snapshot: BankValueSnapshot | null;
  pendingTransactions: PendingTransaction[];
  pendingCardTransactions: PendingCardTransaction[];
  transactions: TransactionSelectorRecord[];
  projectedNextPaycheck: number | null;
  paydayOverrides?: PaydayOverrides | null;
};

function periodLabel(goal: ReturnType<typeof normalizeFinancialGoal>, now: Date, paydayOverrides?: PaydayOverrides | null) {
  const period = goal.success_conditions.find(c => c.field === "spending_period")?.value
    || goal.scope_conditions.find(c => c.field === "pay_period")?.value;
  const raw = Array.isArray(period) ? period[0] : period;
  if (!raw) return null;
  const current = raw === "current" ? getCurrentPayPeriod(now, null, paydayOverrides) : null;
  const dates = current ? [current.start, current.end] : /^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/.test(raw)
    ? raw.split("..").map(d => new Date(`${d}T12:00:00`)) : [];
  return dates.length === 2 ? dates.map(d => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d)).join(" – ") : null;
}

function GoalBrief({ goal, context }: { goal: FinancialGoal; context: GoalContext }) {
  const normalized = normalizeFinancialGoal(goal);
  const evaluation = evaluateFinancialGoal({ goal: normalized, ...context });
  const visible = new Set((goal.pinned_tracking_metrics || []).filter(m => normalized.tracking_metrics.includes(m)));
  const metrics = evaluation.trackingMetrics.filter(m => visible.has(m.metric));
  // Use the evaluator's same target preference; a cash threshold must never look like a spending cap.
  const target = evaluation.conditions.find(c => c.field === "spending")
    || evaluation.conditions.find(c => c.field === "current_balances" || c.field === "account_balance");
  const lowerBound = target && ["greater_than", "greater_than_or_equal"].includes(target.operator);
  const cap = target && ["less_than", "less_than_or_equal"].includes(target.operator) && Number(target.value) > 0;
  const progress = cap && target.actual !== null ? Math.max(0, Math.min(100, target.actual / Number(target.value) * 100)) : null;
  const primary = metrics.filter(m => (m.metric === "remaining_budget" && !lowerBound) || m.metric === "daily_spending_limit")
    .sort((left, right) => Number(left.metric === "daily_spending_limit") - Number(right.metric === "daily_spending_limit"));
  const secondary = metrics.filter(m => !primary.includes(m)
    && !(context.snapshot && cap && m.metric === "total_budget")
    && !(context.snapshot && cap && m.metric === "total_credit_card_spend" && m.value !== null && target.actual !== null && Math.abs(m.value - target.actual) < .005));
  const period = periodLabel(normalized, context.currentDate, context.paydayOverrides);
  const status = !goal.is_active ? "Paused" : evaluation.met ? "Conditions met" : "In progress";
  const metricLabel = (metric: FinancialGoalTrackingMetric) => metric === "remaining_budget" && lowerBound ? "Gap to threshold" : labels[metric];
  const value = (metric: FinancialGoalTrackingMetric, amount: number | null) => {
    if (!context.snapshot) return "—";
    if (amount === null) return "—";
    if (metric === "days_left_in_pay_cycle") return `${amount} ${amount === 1 ? "day" : "days"}`;
    return overviewCurrency(metric === "remaining_budget" && lowerBound ? Math.max(0, amount) : amount);
  };

  return (
    <article className="overview-brief-panel overview-goal" aria-label={goal.name}>
      <header className="overview-brief-section-heading">
        <div><h2>{goal.name}</h2>{period ? <p className="overview-brief-muted overview-brief-caption">{period}</p> : null}</div>
        <span className={`overview-goal-status ${goal.is_active && evaluation.met ? "is-met" : ""}`}>{context.snapshot ? status : "Awaiting snapshot"}</span>
      </header>
      {lowerBound && target.actual !== null ? <dl className="overview-goal-primary"><div><dt>Current balance</dt><dd>{context.snapshot ? overviewCurrency(target.actual) : "—"}</dd></div></dl> : null}
      {primary.length ? <dl className="overview-goal-primary">{primary.map(m => (
        <div key={m.metric}><dt>{metricLabel(m.metric)}</dt><dd className={m.metric === "daily_spending_limit" ? "overview-goal-daily" : ""}>{value(m.metric, m.value)}</dd></div>
      ))}</dl> : null}
      {context.snapshot && target?.actual != null ? (
        <div className="overview-goal-condition">
          {progress !== null ? <div className="overview-budget-track" role="progressbar" aria-label={`${goal.name}: ${target.field === "spending" ? "spending" : "balance"} against cap`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${overviewCurrency(target.actual)} of ${overviewCurrency(target.value)} cap`}><span style={{ width: `${progress}%` }} /></div> : null}
          <div className="overview-brief-line">{!lowerBound ? <span>{overviewCurrency(target.actual)} {target.field === "spending" ? "spent" : "current balance"}</span> : null}<span className="overview-brief-muted">{cap ? "Cap" : "Target"}: {target.operator === "greater_than" ? "> " : target.operator === "greater_than_or_equal" ? "≥ " : target.operator === "equals" ? "= " : target.operator === "not_equals" ? "≠ " : target.operator === "less_than" ? "< " : "≤ "}{overviewCurrency(target.value)}</span></div>
        </div>
      ) : null}
      {secondary.length ? <dl className="overview-goal-secondary">{secondary.map(m => <div key={m.metric}><dt>{metricLabel(m.metric)}</dt><dd>{value(m.metric, m.value)}</dd></div>)}</dl> : null}
      {!metrics.length && !target ? <p className="overview-brief-muted">{evaluation.conditions.filter(c => c.met).length} of {evaluation.conditions.length} conditions met</p> : null}
      <details className="overview-goal-details"><summary>What’s included</summary><p>{context.snapshot ? `${evaluation.conditions.filter(c => c.met).length} of ${evaluation.conditions.length} conditions met.` : "Waiting for account data."} {normalized.scope_conditions.some(c => c.include_outstanding_pending) ? "Includes outstanding pending charges in the selected scope." : "Uses the accounts, transactions, and period selected for this goal."}</p><Link href="/dashboard/budget/goals">View goal and conditions ↗</Link></details>
    </article>
  );
}

export function OverviewFinancialBrief({ context, goals, grossAssets, netAssets, attention, attentionCount = 0, budgetOffset = 0 }: {
  context: GoalContext;
  goals: FinancialGoal[];
  grossAssets: number;
  netAssets: number;
  attention?: ReactNode;
  attentionCount?: number;
  budgetOffset?: number;
}) {
  const pinned = goals.filter(g => g.is_pinned || (g.pinned_tracking_metrics || []).some(m => (g.tracking_metrics || []).includes(m)));
  const hasSnapshot = Boolean(context.snapshot);
  const snapshot = context.snapshot;
  const money = (amount: number, whole = false) => overviewCurrency(hasSnapshot ? amount : null, whole);

  return <div className="overview-brief">
    {attentionCount > 0 ? <section className="overview-brief-attention" aria-labelledby="overview-attention-heading"><h2 id="overview-attention-heading">Needs attention <span className="overview-attention-count">{attentionCount}</span></h2><div className="overview-attention-items">{attention}</div></section> : null}
    <section className="overview-brief-panel overview-assets" aria-label="Asset summary">
      <div className="overview-assets-headline"><h2 className="overview-brief-eyebrow">Net assets</h2><p className={`overview-assets-value ${netAssets < 0 ? "is-negative" : ""}`}>{money(netAssets, true)}</p>
        <p className={`overview-snapshot-change ${Number(snapshot?.change) < 0 ? "is-negative" : ""}`}>{Number(snapshot?.change) > 0 ? "+" : ""}{overviewCurrency(snapshot?.change)} <span className="overview-brief-muted">· snapshot change</span></p>
        {snapshot ? <p className="overview-brief-muted overview-brief-caption">{snapshot.is_highpoint ? "At your latest highpoint" : `${overviewCurrency(Math.abs(Number(snapshot.loss_since_highpoint || 0)))} below your last highpoint · ${Math.abs(Number(snapshot.loss_since_highpoint_percentage || 0)).toFixed(2)}%`}</p> : <p className="overview-brief-muted overview-brief-caption">No account snapshot available yet.</p>}
        <Link className="overview-brief-link" href="/dashboard/snapshots">View snapshots →</Link>
      </div>
      <div className="overview-balance-sheet"><h2 className="overview-brief-eyebrow">Your balance sheet</h2><dl><div><dt>Gross assets</dt><dd>{money(grossAssets)}</dd></div><div><dt>Less liabilities</dt><dd>{hasSnapshot ? overviewCurrency(-(grossAssets - netAssets)) : "—"}</dd></div><div className="overview-balance-total"><dt>Net assets</dt><dd>{money(netAssets)}</dd></div></dl><p className="overview-brief-muted overview-brief-caption">Cash and investments, after liabilities.</p></div>
    </section>
    {budgetOffset !== 0 ? <p className="overview-brief-offset" role="status">Budget offset enabled: {overviewCurrency(budgetOffset)}. The Budget page includes this adjustment; pinned goal metrics use their own conditions.</p> : null}
    {pinned.length ? <div className="overview-brief-goals">{pinned.map(goal => <GoalBrief key={goal.id} goal={goal} context={context} />)}</div> : <div className="overview-brief-panel"><h2>Your goals, at a glance</h2><p className="overview-brief-muted">Pin a goal or its tracking metrics to see them here.</p><Link className="overview-brief-link" href="/dashboard/budget/goals">Choose goals →</Link></div>}
  </div>;
}
