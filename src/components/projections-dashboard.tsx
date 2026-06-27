"use client";

import { useMemo } from "react";

import { useLiveSnapshot } from "@/components/live-snapshot-provider";
import type { IncomeEntry } from "@/lib/income-entry-types";
import type { PendingTransaction } from "@/lib/pending-transaction-types";
import { projectRevenueAfterPayCycle } from "@/lib/projections";

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
  featured = false,
  negative = false,
}: {
  label: string;
  value: string;
  description: string;
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
  initialIncomeEntries,
  initialPendingTransactions,
}: {
  initialIncomeEntries: IncomeEntry[];
  initialPendingTransactions: PendingTransaction[];
}) {
  const { snapshot } = useLiveSnapshot();

  const projection = useMemo(
    () =>
      projectRevenueAfterPayCycle({
        incomeEntries: initialIncomeEntries,
        snapshot,
        pendingTransactions: initialPendingTransactions,
      }),
    [initialIncomeEntries, initialPendingTransactions, snapshot],
  );

  const sampleSize =
    projection.paycheckProjection.normalPaychecks.length +
    projection.paycheckProjection.bonusPaychecks.length;
  const hasIncomeData = sampleSize > 0;

  return (
    <div className="mt-10 space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Next payday"
          value={projection.nextPaydayLabel}
          description={`${projection.daysRemaining} day${
            projection.daysRemaining === 1 ? "" : "s"
          } remaining in the current pay cycle.`}
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
          description="Checking balance plus predicted paycheck minus card payoffs."
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
            Starting from current checking, adding the forecasted paycheck, then
            paying off credit cards.
          </p>
        </div>
        <SummaryRow
          label="Current checking"
          value={formatCurrency(projection.currentChecking)}
        />
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
