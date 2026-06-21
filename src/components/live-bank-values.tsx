"use client";

import { useEffect, useMemo, useState } from "react";

import { APP_BASE_PATH } from "@/lib/config";
import type { BankValueSnapshot } from "@/lib/snapshot-types";

type ConnectionState = "connecting" | "live" | "reconnecting" | "unavailable";
type FinancialView = "overview" | "accounts" | "budget";

const accounts: Array<{
  key: keyof BankValueSnapshot;
  label: string;
  category: string;
}> = [
  { key: "chase_checking", label: "Chase Checking", category: "Cash" },
  { key: "chase_savings", label: "Chase Savings", category: "Cash" },
  { key: "chase_credit", label: "Chase Mastercard", category: "Liability" },
  { key: "citi_current", label: "Citi Card — Current", category: "Liability" },
  { key: "citi_pending", label: "Citi Card — Pending", category: "Pending" },
  { key: "barclays_card", label: "Barclaycard", category: "Liability" },
  { key: "etrade", label: "E*TRADE", category: "Investment" },
  {
    key: "betterment_general",
    label: "Betterment — General",
    category: "Investment",
  },
  {
    key: "betterment_safety",
    label: "Betterment — Safety Net",
    category: "Investment",
  },
  {
    key: "betterment_retirement",
    label: "Betterment — Retirement",
    category: "Retirement",
  },
  {
    key: "fidelity_retirement",
    label: "Fidelity 401(k)",
    category: "Retirement",
  },
];

const budgetSettings = {
  daysToNextPayCycle: 10,
  totalBudget: 1600,
  budgetOffset: 0,
  cashTransferToSavings: 0,
  charge: 0,
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value: string | number | undefined) {
  if (value === undefined) return "—";
  const number = Number(value);
  return Number.isFinite(number) ? currencyFormatter.format(number) : "—";
}

function formatUpdatedAt(value?: string) {
  if (!value) return "Waiting for the first snapshot";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function valueFromSnapshot(
  snapshot: BankValueSnapshot | null,
  key: keyof BankValueSnapshot,
) {
  if (!snapshot) return 0;
  const value = Number(snapshot[key]);
  return Number.isFinite(value) ? value : 0;
}

function SummaryRow({
  label,
  value,
  emphasized = false,
  negative = false,
  badge,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  negative?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-white/[0.07] px-4 py-3.5 last:border-b-0 sm:px-5 ${
        emphasized ? "bg-white/[0.045]" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`min-w-0 text-sm ${
            emphasized ? "font-semibold text-white" : "text-white/70"
          }`}
        >
          {label}
        </span>
        {badge ? (
          <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted sm:inline">
            {badge}
          </span>
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

export function LiveBankValues({
  initialSnapshot,
  view = "overview",
}: {
  initialSnapshot: BankValueSnapshot | null;
  view?: FinancialView;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let disposed = false;

    async function connect() {
      if (disposed) return;
      setConnectionState(reconnectAttempts ? "reconnecting" : "connecting");

      try {
        const ticketResponse = await fetch(
          `${APP_BASE_PATH}/api/snapshots/websocket-ticket`,
          { method: "POST" },
        );
        const ticketData = (await ticketResponse.json().catch(() => null)) as {
          url?: string;
        } | null;

        if (!ticketResponse.ok || !ticketData?.url) {
          throw new Error("Unable to authorize WebSocket.");
        }

        socket = new WebSocket(ticketData.url);
        socket.onopen = () => {
          reconnectAttempts = 0;
          setConnectionState("live");
        };
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data) as {
            type?: string;
            snapshot?: BankValueSnapshot | null;
          };
          if (
            (message.type === "snapshot.initial" ||
              message.type === "snapshot.updated") &&
            message.snapshot
          ) {
            setSnapshot(message.snapshot);
          }
        };
        socket.onerror = () => socket?.close();
        socket.onclose = () => {
          if (disposed) return;
          reconnectAttempts += 1;
          setConnectionState("reconnecting");
          reconnectTimer = setTimeout(
            connect,
            Math.min(1000 * 2 ** (reconnectAttempts - 1), 30000),
          );
        };
      } catch {
        if (disposed) return;
        reconnectAttempts += 1;
        setConnectionState(
          reconnectAttempts > 3 ? "unavailable" : "reconnecting",
        );
        reconnectTimer = setTimeout(
          connect,
          Math.min(1000 * 2 ** (reconnectAttempts - 1), 30000),
        );
      }
    }

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  const calculations = useMemo(() => {
    const chaseChecking = valueFromSnapshot(snapshot, "chase_checking");
    const chaseSavings = valueFromSnapshot(snapshot, "chase_savings");
    const grossLiabilities =
      valueFromSnapshot(snapshot, "chase_credit") +
      valueFromSnapshot(snapshot, "citi_current") +
      valueFromSnapshot(snapshot, "citi_pending") +
      valueFromSnapshot(snapshot, "barclays_card");
    const nonRetirementCash =
      chaseChecking +
      chaseSavings +
      valueFromSnapshot(snapshot, "etrade") +
      valueFromSnapshot(snapshot, "betterment_general") +
      valueFromSnapshot(snapshot, "betterment_safety");
    const retirementCash =
      valueFromSnapshot(snapshot, "betterment_retirement") +
      valueFromSnapshot(snapshot, "fidelity_retirement");
    const grossAssets = nonRetirementCash + retirementCash;
    const budgetDifference = budgetSettings.totalBudget - grossLiabilities;
    const remainingBudget = budgetDifference + budgetSettings.budgetOffset;
    const dailyBudget =
      budgetSettings.daysToNextPayCycle > 0
        ? remainingBudget / budgetSettings.daysToNextPayCycle
        : 0;

    return {
      grossLiabilities,
      nonRetirementCash,
      retirementCash,
      grossAssets,
      budgetDifference,
      remainingBudget,
      dailyBudget,
      checkingAvailable:
        chaseChecking -
        budgetSettings.cashTransferToSavings -
        budgetSettings.charge,
      netAssets: grossAssets - grossLiabilities,
    };
  }, [snapshot]);

  const connectionLabel =
    connectionState === "live"
      ? "Live updates"
      : connectionState === "connecting"
        ? "Connecting"
        : connectionState === "reconnecting"
          ? "Reconnecting"
          : "Live updates unavailable";

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Snapshot updated {formatUpdatedAt(snapshot?.source_updated_at)}
        </p>
        <div
          className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
            connectionState === "live"
              ? "border-accent/20 bg-accent/10 text-accent"
              : "border-amber-200/20 bg-amber-200/10 text-amber-100"
          }`}
        >
          <span
            className={`size-2 rounded-full ${
              connectionState === "live"
                ? "bg-accent shadow-[0_0_12px_rgba(86,226,170,0.8)]"
                : "bg-amber-200"
            }`}
          />
          {connectionLabel}
        </div>
      </div>

      {view === "overview" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total budget"
            value={formatCurrency(budgetSettings.totalBudget)}
            description="Budget allocated for the current pay cycle."
          />
          <MetricCard
            label="Remaining budget"
            value={formatCurrency(calculations.remainingBudget)}
            description="Total budget less current card obligations."
            featured
            negative={calculations.remainingBudget < 0}
          />
          <MetricCard
            label="Days until pay cycle"
            value={`${budgetSettings.daysToNextPayCycle}`}
            description="Days remaining in the current planning period."
          />
          <MetricCard
            label="Daily budget"
            value={formatCurrency(calculations.dailyBudget)}
            description="Remaining budget available per day."
            featured
            negative={calculations.dailyBudget < 0}
          />
          <MetricCard
            label="Gross assets"
            value={formatCurrency(calculations.grossAssets)}
            description="Cash and investment balances combined."
          />
          <MetricCard
            label="Gross liabilities"
            value={formatCurrency(-calculations.grossLiabilities)}
            description="Current and pending credit-card balances."
            negative={calculations.grossLiabilities > 0}
          />
          <div className="sm:col-span-2">
            <MetricCard
              label="Net assets"
              value={formatCurrency(calculations.netAssets)}
              description="Gross assets after subtracting current liabilities."
              featured
              negative={calculations.netAssets < 0}
            />
          </div>
        </div>
      ) : null}

      {view === "accounts" ? (
        <div className="surface overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Current balances
            </p>
            <p className="mt-1 text-sm text-muted">
              All values come from the latest portfolio snapshot.
            </p>
          </div>
          {accounts.map((account) => (
            <SummaryRow
              key={account.key}
              label={account.label}
              badge={account.category}
              value={formatCurrency(
                snapshot?.[account.key] as string | undefined,
              )}
            />
          ))}
        </div>
      ) : null}

      {view === "budget" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Budget plan
              </p>
            </div>
            <SummaryRow
              label="Days until next pay cycle"
              value={`${budgetSettings.daysToNextPayCycle} days`}
            />
            <SummaryRow
              label="Total budget"
              value={formatCurrency(budgetSettings.totalBudget)}
            />
            <SummaryRow
              label="Credit card debt"
              value={formatCurrency(-calculations.grossLiabilities)}
              negative={calculations.grossLiabilities > 0}
            />
            <SummaryRow
              label="Budget difference"
              value={formatCurrency(calculations.budgetDifference)}
              negative={calculations.budgetDifference < 0}
            />
            <SummaryRow
              label="Budget offset"
              value={formatCurrency(budgetSettings.budgetOffset)}
            />
            <SummaryRow
              label="Remaining budget"
              value={formatCurrency(calculations.remainingBudget)}
              emphasized
              negative={calculations.remainingBudget < 0}
            />
            <SummaryRow
              label="Daily budget"
              value={formatCurrency(calculations.dailyBudget)}
              emphasized
              negative={calculations.dailyBudget < 0}
            />
          </div>

          <div className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Cash position
              </p>
            </div>
            <SummaryRow
              label="Cash — non-retirement"
              value={formatCurrency(calculations.nonRetirementCash)}
            />
            <SummaryRow
              label="Cash — retirement"
              value={formatCurrency(calculations.retirementCash)}
            />
            <SummaryRow
              label="Cash transfer to savings"
              value={formatCurrency(budgetSettings.cashTransferToSavings)}
            />
            <SummaryRow
              label="Checking available"
              value={formatCurrency(calculations.checkingAvailable)}
              emphasized
              negative={calculations.checkingAvailable < 0}
            />
            <SummaryRow
              label="Charge"
              value={formatCurrency(budgetSettings.charge)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
