"use client";

import { type ReactNode, useMemo, useState } from "react";

import { useLiveSnapshot } from "@/components/live-snapshot-provider";
import type { BudgetPlanSettings } from "@/lib/budget-plan-settings-types";
import type { BudgetItem } from "@/lib/budget-item-types";
import { APP_BASE_PATH } from "@/lib/config";
import type { CreditCardTransaction } from "@/lib/credit-card-transaction-types";
import type { ExpenseEntry } from "@/lib/expense-entry-types";
import type { IncomeEntry } from "@/lib/income-entry-types";
import type { PendingTransaction } from "@/lib/pending-transaction-types";
import {
  followingPayday,
  formatPayday,
  localPaydayString,
} from "@/lib/pay-cycle";
import {
  projectCurrentYear,
  projectRevenueAfterPayCycle,
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
      className={`rounded-2xl border p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)] ${
        featured
          ? "border-accent/25 bg-accent/[0.09]"
          : "border-white/10 bg-white/[0.045]"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <p
        className={`mt-4 font-mono text-2xl font-semibold tracking-tight sm:text-3xl ${
          negative ? "text-rose-300" : featured ? "text-accent" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-3 text-xs leading-5 text-muted">{description}</p>
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
  budgetItems,
  creditCardTransactions,
  expenseEntries,
  initialBudgetPlanSettings,
  initialIncomeEntries,
  initialPendingTransactions,
}: {
  budgetItems: BudgetItem[];
  creditCardTransactions: CreditCardTransaction[];
  expenseEntries: ExpenseEntry[];
  initialBudgetPlanSettings: BudgetPlanSettings;
  initialIncomeEntries: IncomeEntry[];
  initialPendingTransactions: PendingTransaction[];
}) {
  const { snapshot } = useLiveSnapshot();
  const [nextPaydayOverride, setNextPaydayOverride] = useState(
    initialBudgetPlanSettings.next_payday_override,
  );
  const [confirmingFastForward, setConfirmingFastForward] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [fastForwardError, setFastForwardError] = useState("");

  const projection = useMemo(
    () =>
      projectRevenueAfterPayCycle({
        incomeEntries: initialIncomeEntries,
        snapshot,
        pendingTransactions: initialPendingTransactions,
        nextPaydayOverride,
      }),
    [
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
        budgetItems,
        expenseEntries,
        creditCardTransactions,
        nextPaydayOverride,
      }),
    [
      budgetItems,
      creditCardTransactions,
      expenseEntries,
      initialIncomeEntries,
      nextPaydayOverride,
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

      setNextPaydayOverride(data.next_payday_override);
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
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          label="Predicted paycheck"
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
          label="Credit card payoff"
          value={formatCurrency(-projection.creditCardPayoff)}
          description="Assumes all current card balances are paid in full."
          negative={projection.creditCardPayoff > 0}
        />
        <MetricCard
          label="Projected cash after pay cycle"
          value={formatCurrency(projection.projectedCashAfterPayCycle)}
          description="Predicted paycheck minus card payoffs."
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
            Starting from the forecasted paycheck, then paying off credit cards.
          </p>
        </div>
        <SummaryRow
          detail="Based on median net pay from normal paychecks in the last year."
          label="Predicted next paycheck"
          value={`+${formatCurrency(projection.predictedNextPaycheck)}`}
        />
        <SummaryRow
          detail="Chase, Citi, and Barclaycard balances from the latest snapshot."
          label="Credit card payoff"
          negative={projection.creditCardPayoff > 0}
          value={`-${formatCurrency(projection.creditCardPayoff)}`}
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
