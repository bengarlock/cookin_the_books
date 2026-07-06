"use client";

import { useState, type FormEvent } from "react";

import { useBudgetData } from "@/components/budget-data-provider";
import { APP_BASE_PATH } from "@/lib/config";
import { useLiveSnapshot } from "@/components/live-snapshot-provider";
import type { FinancialGoal, FinancialGoalInput } from "@/lib/financial-goal-types";
import { calculateFinancialGoalMetrics } from "@/lib/financial-goal-metrics";
import { getCurrentPayPeriod, localPaydayString } from "@/lib/pay-cycle";
import { dailyExpenseAverage, projectRevenueAfterPayCycle } from "@/lib/projections";

const emptyGoal: FinancialGoalInput = {
  goal_type: "spending",
  name: "Pay cycle spending cap",
  target_amount: "",
  period_mode: "current_pay_period",
  pay_cycle_start: null,
  pay_cycle_end: null,
  is_active: true,
};

async function responseMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message || "The financial goal could not be saved.";
}

function currency(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function GoalFields({
  value,
  onChange,
}: {
  value: FinancialGoalInput;
  onChange: (value: FinancialGoalInput) => void;
}) {
  const inputClass =
    "mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent/40";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted sm:col-span-2">
        Goal name
        <input className={inputClass} maxLength={100} onChange={(event) => onChange({ ...value, name: event.target.value })} required value={value.name} />
      </label>
      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted sm:col-span-2">
        Spending cap
        <input className={inputClass} inputMode="decimal" min="0.01" onChange={(event) => onChange({ ...value, target_amount: event.target.value })} placeholder="$0.00" required step="0.01" type="number" value={value.target_amount} />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Goal timing</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className={`rounded-xl border p-3 text-sm ${value.period_mode === "current_pay_period" ? "border-accent/30 bg-accent/10 text-accent" : "border-white/10 text-white/60"}`}>
            <input checked={value.period_mode === "current_pay_period"} className="mr-2" name="period-mode" onChange={() => onChange({ ...value, period_mode: "current_pay_period", pay_cycle_start: null, pay_cycle_end: null })} type="radio" />
            Current Pay Period
            <span className="mt-1 block text-xs font-normal text-muted">Ongoing; advances automatically each pay cycle.</span>
          </label>
          <label className={`rounded-xl border p-3 text-sm ${value.period_mode === "custom_dates" ? "border-accent/30 bg-accent/10 text-accent" : "border-white/10 text-white/60"}`}>
            <input checked={value.period_mode === "custom_dates"} className="mr-2" name="period-mode" onChange={() => onChange({ ...value, period_mode: "custom_dates" })} type="radio" />
            Custom dates
            <span className="mt-1 block text-xs font-normal text-muted">Use a fixed, one-time date range.</span>
          </label>
        </div>
      </fieldset>
      {value.period_mode === "custom_dates" ? <>
        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Pay cycle starts
          <input className={inputClass} onChange={(event) => onChange({ ...value, pay_cycle_start: event.target.value })} required type="date" value={value.pay_cycle_start || ""} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Pay cycle ends
          <input className={inputClass} min={value.pay_cycle_start || undefined} onChange={(event) => onChange({ ...value, pay_cycle_end: event.target.value })} required type="date" value={value.pay_cycle_end || ""} />
        </label>
      </> : null}
      <label className="flex items-center gap-2 text-sm text-white/70 sm:col-span-2">
        <input checked={value.is_active} onChange={(event) => onChange({ ...value, is_active: event.target.checked })} type="checkbox" />
        Active goal
      </label>
    </div>
  );
}

export function FinancialGoals({
  initialGoals,
}: {
  initialGoals: FinancialGoal[];
}) {
  const { snapshot } = useLiveSnapshot();
  const {
    budgetItems,
    expenseEntries,
    creditCardTransactions,
    incomeEntries,
    pendingTransactions,
    budgetPlanSettings,
  } = useBudgetData();
  const nextPaydayOverride = budgetPlanSettings.next_payday_override;
  const projection = projectRevenueAfterPayCycle({
    incomeEntries,
    budgetItems,
    expenseEntries,
    creditCardTransactions,
    snapshot,
    pendingTransactions,
    nextPaydayOverride,
  });
  const nonCreditCardDailyExpenses = dailyExpenseAverage({
    budgetItems,
    expenseEntries,
    creditCardTransactions,
    excludeCreditCard: true,
  });
  const [goals, setGoals] = useState(initialGoals);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<FinancialGoalInput>(emptyGoal);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<FinancialGoalInput>(emptyGoal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createGoal(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    const response = await fetch(`${APP_BASE_PATH}/api/financial-goals`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
    });
    if (!response.ok) { setError(await responseMessage(response)); setSaving(false); return; }
    const goal = (await response.json()) as FinancialGoal;
    setGoals((current) => [goal, ...current]);
    setDraft(emptyGoal); setCreating(false); setSaving(false);
  }

  function beginEdit(goal: FinancialGoal) {
    setEditingId(goal.id);
    setEditDraft({ goal_type: goal.goal_type, name: goal.name, target_amount: goal.target_amount, period_mode: goal.period_mode, pay_cycle_start: goal.pay_cycle_start, pay_cycle_end: goal.pay_cycle_end, is_active: goal.is_active });
    setError("");
  }

  async function updateGoal(event: FormEvent) {
    event.preventDefault();
    if (editingId === null) return;
    setSaving(true); setError("");
    const response = await fetch(`${APP_BASE_PATH}/api/financial-goals/${editingId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editDraft),
    });
    if (!response.ok) { setError(await responseMessage(response)); setSaving(false); return; }
    const goal = (await response.json()) as FinancialGoal;
    setGoals((current) => current.map((item) => item.id === goal.id ? goal : item));
    setEditingId(null); setSaving(false);
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Financial goals</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Give each pay cycle a target</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Create goals you can revisit and adjust as your priorities change.</p>
        </div>
        {!creating ? <button className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#07100f] transition hover:bg-[#7aebbd]" onClick={() => { setCreating(true); setError(""); }} type="button">Create goal</button> : null}
      </div>

      {creating ? (
        <form className="surface rounded-2xl p-5" onSubmit={createGoal}>
          <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Spending goal template</p><h3 className="mt-2 text-lg font-semibold text-white">Cap spending for a pay cycle</h3></div>
          <GoalFields onChange={setDraft} value={draft} />
          {error ? <p className="mt-4 text-sm text-rose-300" role="alert">{error}</p> : null}
          <div className="mt-5 flex gap-3"><button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[#07100f] disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving…" : "Save goal"}</button><button className="rounded-xl border border-white/10 px-4 py-2 text-sm text-muted" onClick={() => setCreating(false)} type="button">Cancel</button></div>
        </form>
      ) : null}

      <div className="grid gap-4">
        {goals.map((goal) => {
          const currentPeriod = getCurrentPayPeriod(new Date(), nextPaydayOverride);
          const periodStart = goal.period_mode === "current_pay_period" ? currentPeriod.start : new Date(`${goal.pay_cycle_start}T00:00:00`);
          const periodEnd = goal.period_mode === "current_pay_period" ? currentPeriod.end : new Date(`${goal.pay_cycle_end}T00:00:00`);
          const metrics = calculateFinancialGoalMetrics({
            cap: Number(goal.target_amount),
            periodStart: localPaydayString(periodStart),
            periodEnd: localPaydayString(periodEnd),
            today: localPaydayString(new Date()),
            projectedPaycheck: projection.predictedNextPaycheck,
            averageDailyExpenses: nonCreditCardDailyExpenses,
            snapshot,
            pendingTransactions,
          });
          return editingId === goal.id ? (
          <form className="surface rounded-2xl p-5" key={goal.id} onSubmit={updateGoal}>
            <GoalFields onChange={setEditDraft} value={editDraft} />
            {error ? <p className="mt-4 text-sm text-rose-300" role="alert">{error}</p> : null}
            <div className="mt-5 flex gap-3"><button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[#07100f] disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving…" : "Update goal"}</button><button className="rounded-xl border border-white/10 px-4 py-2 text-sm text-muted" onClick={() => setEditingId(null)} type="button">Cancel</button></div>
          </form>
        ) : (
          <article className="surface overflow-hidden rounded-2xl" key={goal.id}>
            <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="flex items-center gap-2"><h3 className="font-semibold text-white">{goal.name}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${goal.is_active ? "bg-accent/10 text-accent" : "bg-white/5 text-muted"}`}>{goal.is_active ? "Active" : "Paused"}</span></div><p className="mt-2 text-sm text-muted">{periodStart.toLocaleDateString()} – {periodEnd.toLocaleDateString()}</p>{goal.period_mode === "current_pay_period" ? <p className="mt-1 text-xs text-accent">Current Pay Period · renews automatically</p> : null}</div>
              <div className="flex items-center gap-4"><div className="text-right"><p className="text-xs uppercase tracking-[0.14em] text-muted">Spending cap</p><p className="mt-1 font-mono text-xl font-semibold text-accent">{currency(Number(goal.target_amount))}</p></div><button className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/70 hover:border-accent/30 hover:text-accent" onClick={() => beginEdit(goal)} type="button">Edit</button></div>
            </div>
            <div className="p-5">
              <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Progress</p><p className="mt-1 font-mono text-2xl font-semibold text-white">{currency(metrics.spent)} <span className="text-sm font-normal text-muted">spent</span></p></div><p className={`font-mono text-sm font-semibold ${metrics.remaining >= 0 ? "text-accent" : "text-rose-300"}`}>{currency(Math.abs(metrics.remaining))} {metrics.remaining >= 0 ? "left" : "over"}</p></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${metrics.progress > 100 ? "bg-rose-400" : "bg-accent"}`} style={{ width: `${Math.min(100, metrics.progress)}%` }} /></div>
              <p className="mt-2 text-right text-xs text-muted">{metrics.progress.toFixed(1)}% of cap used</p>
              <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Days left", `${metrics.daysLeft}`],
                  ["Daily allowance", currency(metrics.dailyAllowance)],
                  ["Projected finish", currency(metrics.projectedSpend)],
                  ["Projected paycheck", currency(metrics.projectedPaycheck)],
                  ["Projected Expenses", currency(metrics.projectedCycleExpenses)],
                  ["Projected Savings", currency(metrics.projectedSavings)],
                ].map(([label, value]) => <div className="bg-panel px-4 py-3" key={label}><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p><p className="mt-1 whitespace-nowrap font-mono text-sm font-semibold text-white">{value}</p></div>)}
              </div>
            </div>
          </article>
          );
        })}
        {!goals.length && !creating ? <div className="surface rounded-2xl p-8 text-center"><p className="text-sm text-muted">No financial goals yet. Start with a spending cap for your next pay cycle.</p></div> : null}
      </div>
    </div>
  );
}
