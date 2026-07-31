"use client";

import { type ReactNode, useMemo, useState } from "react";

import { useLiveSnapshot } from "@/components/live-snapshot-provider";
import type { BudgetItem } from "@/lib/budget-item-types";
import type { BudgetPlanSettings } from "@/lib/budget-plan-settings-types";
import { APP_BASE_PATH } from "@/lib/config";
import type {
  BudgetAverageTransaction,
  IncomeTransaction,
} from "@/lib/credit-card-transaction-types";
import type { ExpenseEntry } from "@/lib/expense-entry-types";
import type { IncomeEntry } from "@/lib/income-entry-types";
import type { PendingTransaction } from "@/lib/pending-transaction-types";
import {
  followingPayday,
  formatPayday,
  localPaydayString,
} from "@/lib/pay-cycle";
import {
  formatRunwayDuration,
  projectCurrentYear,
  projectRevenueAfterPayCycle,
  projectUnemploymentRunway,
} from "@/lib/projections";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00`));
}

function MetricCard({
  label,
  value,
  description,
  action,
  featured = false,
  negative = false,
}: {
  label: string;
  value: string;
  description: string;
  action?: ReactNode;
  featured?: boolean;
  negative?: boolean;
}) {
  return (
    <article
      className={`dashboard-tile rounded-2xl border p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)] ${
        featured
          ? "dashboard-tile-featured border-accent/25 bg-accent/[0.09]"
          : "border-white/10 bg-white/[0.045]"
      }`}
    >
      <p className="dashboard-tile-label text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <p
        className={`dashboard-tile-value mt-4 font-mono text-2xl font-semibold tracking-tight sm:text-3xl ${
          negative
            ? "dashboard-tile-value-negative text-rose-300"
            : featured
              ? "dashboard-tile-value-featured text-accent"
              : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="dashboard-tile-description mt-3 text-xs leading-5 text-muted">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </article>
  );
}

function SummaryRow({
  label,
  value,
  emphasized = false,
  negative = false,
  detail,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  negative?: boolean;
  detail?: string;
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-white/[0.07] px-4 py-3.5 last:border-b-0 sm:px-5 ${
        emphasized ? "bg-white/[0.045]" : ""
      }`}
    >
      <div className="min-w-0">
        <p
          className={`text-sm ${
            emphasized ? "font-semibold text-white" : "text-white/70"
          }`}
        >
          {label}
        </p>
        {detail ? (
          <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
        ) : null}
      </div>
      <span
        className={`whitespace-nowrap font-mono text-sm sm:text-base ${
          negative
            ? "font-semibold text-rose-300"
            : emphasized
              ? "font-semibold text-white"
              : "text-white/90"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function ProjectionsDashboard({
  initialBudgetItems,
  initialBudgetPlanSettings,
  initialCreditCardTransactions,
  initialExpenseEntries,
  initialIncomeEntries,
  initialIncomeTransactions,
  initialPendingTransactions,
}: {
  initialBudgetItems: BudgetItem[];
  initialBudgetPlanSettings: BudgetPlanSettings;
  initialCreditCardTransactions: BudgetAverageTransaction[];
  initialExpenseEntries: ExpenseEntry[];
  initialIncomeEntries: IncomeEntry[];
  initialIncomeTransactions: IncomeTransaction[];
  initialPendingTransactions: PendingTransaction[];
}) {
  const { snapshot } = useLiveSnapshot();
  const [budgetPlanSettings, setBudgetPlanSettings] = useState(
    initialBudgetPlanSettings,
  );
  const nextPaydayOverride = budgetPlanSettings.next_payday_override;
  const [confirmingFastForward, setConfirmingFastForward] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [fastForwardError, setFastForwardError] = useState("");

  const projection = useMemo(
    () =>
      projectRevenueAfterPayCycle({
        incomeEntries: initialIncomeEntries,
        budgetItems: initialBudgetItems,
        expenseEntries: initialExpenseEntries,
        creditCardTransactions: initialCreditCardTransactions,
        snapshot,
        pendingTransactions: initialPendingTransactions,
        nextPaydayOverride,
      }),
    [
      initialBudgetItems,
      initialCreditCardTransactions,
      initialExpenseEntries,
      initialIncomeEntries,
      initialPendingTransactions,
      nextPaydayOverride,
      snapshot,
    ],
  );

  const yearProjection = useMemo(
    () =>
      projectCurrentYear({
        incomeEntries: initialIncomeEntries,
        budgetItems: initialBudgetItems,
        expenseEntries: initialExpenseEntries,
        creditCardTransactions: initialCreditCardTransactions,
        incomeTransactions: initialIncomeTransactions,
        nextPaydayOverride,
      }),
    [
      initialBudgetItems,
      initialCreditCardTransactions,
      initialExpenseEntries,
      initialIncomeEntries,
      initialIncomeTransactions,
      nextPaydayOverride,
    ],
  );

  const unemploymentRunway = useMemo(
    () =>
      projectUnemploymentRunway({
        budgetItems: initialBudgetItems,
        expenseEntries: initialExpenseEntries,
        creditCardTransactions: initialCreditCardTransactions,
        snapshot,
        pendingTransactions: initialPendingTransactions,
      }),
    [
      initialBudgetItems,
      initialCreditCardTransactions,
      initialExpenseEntries,
      initialPendingTransactions,
      snapshot,
    ],
  );

  const fastForwardPayday = followingPayday(projection.nextPayday);

  async function fastForwardPayCycle() {
    setIsFastForwarding(true);
    setFastForwardError("");

    try {
      const response = await fetch(`${APP_BASE_PATH}/api/budget-plan-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          next_payday_override: localPaydayString(fastForwardPayday),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | BudgetPlanSettings
        | { message?: string; detail?: string }
        | null;
      if (!response.ok || !data || !("next_payday_override" in data)) {
        throw new Error(
          (data && "message" in data && data.message) ||
            (data && "detail" in data && data.detail) ||
            "Unable to fast forward the pay cycle.",
        );
      }

      setBudgetPlanSettings(data as BudgetPlanSettings);
      setConfirmingFastForward(false);
    } catch (error) {
      setFastForwardError(
        error instanceof Error
          ? error.message
          : "Unable to fast forward the pay cycle.",
      );
    } finally {
      setIsFastForwarding(false);
    }
  }

  const sampleSize =
    projection.paycheckProjection.normalPaychecks.length +
    projection.paycheckProjection.bonusPaychecks.length;
  const hasIncomeData = sampleSize > 0;

  return (
    <div className="mt-10 space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={`${yearProjection.year} projected income`}
          value={formatCurrency(yearProjection.projectedIncome)}
          description={
            yearProjection.predictedPaycheck > 0
              ? `${formatCurrency(yearProjection.ytdIncome)} year to date plus ${yearProjection.remainingPaydays} remaining paycheck${
                  yearProjection.remainingPaydays === 1 ? "" : "s"
                } at ${formatCurrency(yearProjection.predictedPaycheck)} each.`
              : `${formatCurrency(yearProjection.ytdIncome)} year to date. Add income history to forecast remaining paychecks.`
          }
        />
        <MetricCard
          label={`${yearProjection.year} projected expenses`}
          value={formatCurrency(yearProjection.projectedExpenses)}
          description={`${formatCurrency(yearProjection.ytdExpenses)} year to date plus ${formatCurrency(
            yearProjection.forecastExpenses,
          )} forecast through Dec 31 from current monthly averages.`}
          negative
        />
        <MetricCard
          featured
          label={`${yearProjection.year} net gain / loss`}
          negative={yearProjection.projectedNet < 0}
          value={formatCurrency(yearProjection.projectedNet)}
          description="Projected income minus projected expenses for the calendar year."
        />
        <MetricCard
          label="Unemployment runway"
          value={formatRunwayDuration(
            unemploymentRunway.runwayDays,
            unemploymentRunway.runwayYears,
          )}
          description={
            unemploymentRunway.dailyBurnRate > 0
              ? `${formatCurrency(unemploymentRunway.liquidReserves)} in liquid reserves (cash and taxable investments, excluding retirement and 401(k)) minus ${formatCurrency(
                  unemploymentRunway.liabilities,
                )} liabilities, at ${formatCurrency(
                  unemploymentRunway.dailyBurnRate,
                )}/day average expenses.`
              : `${formatCurrency(unemploymentRunway.liquidReserves)} in liquid reserves. Add expense history to estimate runway.`
          }
          negative={
            unemploymentRunway.runwayDays !== null &&
            unemploymentRunway.runwayDays <= 0
          }
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Next payday"
          value={projection.nextPaydayLabel}
          description={`${projection.daysRemaining} day${
            projection.daysRemaining === 1 ? "" : "s"
          } remaining in the current pay cycle.`}
          action={
            confirmingFastForward ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-100/80">
                  Advance next payday to {formatPayday(fastForwardPayday)}?
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/15 disabled:cursor-wait disabled:opacity-60"
                    disabled={isFastForwarding}
                    onClick={fastForwardPayCycle}
                    type="button"
                  >
                    {isFastForwarding ? "Saving…" : "Confirm"}
                  </button>
                  <button
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-white/20 hover:text-white disabled:opacity-60"
                    disabled={isFastForwarding}
                    onClick={() => {
                      setConfirmingFastForward(false);
                      setFastForwardError("");
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
                {fastForwardError ? (
                  <p className="text-xs text-rose-300" role="alert">
                    {fastForwardError}
                  </p>
                ) : null}
              </div>
            ) : (
              <button
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-accent/30 hover:bg-accent/10 hover:text-accent"
                onClick={() => setConfirmingFastForward(true)}
                type="button"
              >
                Fast forward
              </button>
            )
          }
        />
        <MetricCard
          label="Projected Income"
          value={formatCurrency(projection.predictedNextPaycheck)}
          description={
            hasIncomeData
              ? `Median of ${projection.paycheckProjection.normalPaychecks.length} normal paycheck${
                  projection.paycheckProjection.normalPaychecks.length === 1
                    ? ""
                    : "s"
                } from the past year.`
              : "Add income history to forecast the next paycheck."
          }
        />
        <MetricCard
          label="Projected Spend"
          value={formatCurrency(-projection.predictedSpend)}
          description={`${formatCurrency(
            projection.spentThisPayCycle,
          )} spent so far plus ${formatCurrency(
            projection.predictedAdditionalSpend,
          )} expected over the remaining ${projection.daysRemaining} day${
            projection.daysRemaining === 1 ? "" : "s"
          }.`}
          negative={projection.predictedSpend > 0}
        />
        <MetricCard
          label="Projected cash after pay cycle"
          value={formatCurrency(projection.projectedCashAfterPayCycle)}
          description="Projected income minus spending already incurred and expected for the rest of this pay cycle."
          featured
          negative={projection.projectedCashAfterPayCycle < 0}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 px-4 py-4 sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Projection breakdown
          </p>
          <p className="mt-2 text-sm text-muted">
            Starting from projected income, then subtracting spending already
            incurred and expected for the rest of this pay cycle.
          </p>
        </div>
        <SummaryRow
          detail="Based on median net pay from normal paychecks in the last year."
          label="Projected income"
          value={`+${formatCurrency(projection.predictedNextPaycheck)}`}
        />
        <SummaryRow
          detail="Expenses recorded since the current pay cycle began."
          label="Spent this pay cycle"
          negative={projection.spentThisPayCycle > 0}
          value={`-${formatCurrency(projection.spentThisPayCycle)}`}
        />
        <SummaryRow
          detail={`${formatCurrency(
            projection.dailyAverageExpense,
          )} daily average expense multiplied by ${projection.daysRemaining} day${
            projection.daysRemaining === 1 ? "" : "s"
          } until the pay cycle.`}
          label="Expected additional spend"
          negative={projection.predictedAdditionalSpend > 0}
          value={`-${formatCurrency(projection.predictedAdditionalSpend)}`}
        />
        <SummaryRow
          detail="Spending already incurred plus expected additional spend."
          label="Projected spend"
          negative={projection.predictedSpend > 0}
          value={`-${formatCurrency(projection.predictedSpend)}`}
        />
        <SummaryRow
          emphasized
          label="Projected cash after pay cycle"
          negative={projection.projectedCashAfterPayCycle < 0}
          value={formatCurrency(projection.projectedCashAfterPayCycle)}
        />
      </section>

      {projection.liabilityBreakdown.length ? (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-4 py-4 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              Credit card payoff detail
            </p>
          </div>
          {projection.liabilityBreakdown.map((item) => (
            <SummaryRow
              key={item.account}
              label={item.label}
              negative
              value={`-${formatCurrency(item.amount)}`}
            />
          ))}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 px-4 py-4 sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Paycheck forecast basis
          </p>
          <p className="mt-2 text-sm text-muted">
            Reviewing pay statements from {formatDate(projection.paycheckProjection.lookbackStart)}{" "}
            through {formatDate(projection.paycheckProjection.lookbackEnd)}. Bonus
            payouts are excluded from the forecast.
          </p>
        </div>

        {!hasIncomeData ? (
          <p className="px-4 py-5 text-sm text-muted sm:px-5">
            No income history is available for the past year. Import pay
            statements on the Income page to enable projections.
          </p>
        ) : (
          <>
            {projection.paycheckProjection.normalPaychecks.map((paycheck) => (
              <SummaryRow
                detail={`${paycheck.entry.employer} · ${formatDate(paycheck.entry.pay_date)}`}
                key={paycheck.entry.id}
                label="Normal paycheck"
                value={formatCurrency(paycheck.netPay)}
              />
            ))}
            {projection.paycheckProjection.bonusPaychecks.map((paycheck) => (
              <SummaryRow
                detail={`${paycheck.entry.employer} · ${formatDate(paycheck.entry.pay_date)} · excluded from forecast`}
                key={paycheck.entry.id}
                label="Bonus paycheck"
                value={formatCurrency(paycheck.netPay)}
              />
            ))}
          </>
        )}
      </section>
    </div>
  );
}
