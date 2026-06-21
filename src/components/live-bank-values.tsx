"use client";

import { useEffect, useMemo, useState } from "react";

import { APP_BASE_PATH } from "@/lib/config";
import type { BankValueSnapshot } from "@/lib/snapshot-types";

type ConnectionState = "connecting" | "live" | "reconnecting" | "unavailable";

const accounts: Array<{
  key: keyof BankValueSnapshot;
  label: string;
}> = [
  { key: "chase_checking", label: "Chase Checking" },
  { key: "chase_savings", label: "Chase Savings" },
  { key: "chase_credit", label: "Chase Mastercard" },
  { key: "citi_current", label: "Citi Card — Current" },
  { key: "citi_pending", label: "Citi Card — Pending" },
  { key: "barclays_card", label: "Barclaycard" },
  { key: "etrade", label: "E*TRADE" },
  {
    key: "betterment_general",
    label: "Betterment — General",
  },
  {
    key: "betterment_safety",
    label: "Betterment — Safety Net",
  },
  {
    key: "betterment_retirement",
    label: "Betterment — Retirement",
  },
  {
    key: "fidelity_retirement",
    label: "Fidelity 401(k)",
  },
];

const budgetSettings = {
  daysToNextPayCycle: 10,
  payCycleBudget: 1600,
  budgetOffset: 0,
  cashTransferToSavings: 0,
  charge: 0,
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value: string | number | undefined) {
  if (value === undefined) {
    return "—";
  }

  const number = Number(value);
  return Number.isFinite(number) ? currencyFormatter.format(number) : "—";
}

function formatUpdatedAt(value?: string) {
  if (!value) {
    return "Waiting for the first snapshot";
  }

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
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-white/[0.07] px-4 py-3 last:border-b-0 sm:px-5 ${
        emphasized ? "bg-white/[0.045]" : ""
      }`}
    >
      <span
        className={`min-w-0 text-sm ${
          emphasized ? "font-semibold text-white" : "text-white/70"
        }`}
      >
        {label}
      </span>
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

export function LiveBankValues({
  initialSnapshot,
}: {
  initialSnapshot: BankValueSnapshot | null;
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

        socket.onerror = () => {
          socket?.close();
        };

        socket.onclose = () => {
          if (disposed) return;
          reconnectAttempts += 1;
          setConnectionState("reconnecting");
          const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 30000);
          reconnectTimer = setTimeout(connect, delay);
        };
      } catch {
        if (disposed) return;
        reconnectAttempts += 1;
        setConnectionState(
          reconnectAttempts > 3 ? "unavailable" : "reconnecting",
        );
        const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 30000);
        reconnectTimer = setTimeout(connect, delay);
      }
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  const connectionLabel = useMemo(() => {
    if (connectionState === "live") return "Live updates";
    if (connectionState === "connecting") return "Connecting";
    if (connectionState === "reconnecting") return "Reconnecting";
    return "Live updates unavailable";
  }, [connectionState]);

  const calculations = useMemo(() => {
    const chaseChecking = valueFromSnapshot(snapshot, "chase_checking");
    const chaseSavings = valueFromSnapshot(snapshot, "chase_savings");
    const creditCardDebt =
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
    const budgetDifference =
      budgetSettings.payCycleBudget - creditCardDebt;
    const remainingBudget =
      budgetDifference + budgetSettings.budgetOffset;
    const dailyBudget =
      budgetSettings.daysToNextPayCycle > 0
        ? remainingBudget / budgetSettings.daysToNextPayCycle
        : 0;
    const checkingAvailable =
      chaseChecking -
      budgetSettings.cashTransferToSavings -
      budgetSettings.charge;

    return {
      creditCardDebt,
      nonRetirementCash,
      retirementCash,
      grossAssets,
      budgetDifference,
      remainingBudget,
      dailyBudget,
      checkingAvailable,
      netAssets: grossAssets - creditCardDebt,
    };
  }, [snapshot]);

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

      <div className="surface overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Account overview
            </p>
            <p className="mt-1 text-sm text-muted">
              Current balances and planning summary
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              Remaining budget
            </p>
            <p
              className={`mt-1 font-mono text-xl font-semibold ${
                calculations.remainingBudget < 0
                  ? "text-rose-300"
                  : "text-accent"
              }`}
            >
              {formatCurrency(calculations.remainingBudget)}
            </p>
          </div>
        </div>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="border-b border-white/10 xl:border-r xl:border-b-0">
            <div className="border-b border-white/10 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-white">Accounts</h2>
            </div>
            {accounts.map((account) => (
              <SummaryRow
                key={account.key}
                label={account.label}
                value={formatCurrency(
                  snapshot?.[account.key] as string | undefined,
                )}
              />
            ))}
          </div>

          <div>
            <div className="border-b border-white/10 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-white">
                Budget and cash position
              </h2>
            </div>
            <SummaryRow
              label="Time to next pay cycle"
              value={`${budgetSettings.daysToNextPayCycle} days`}
            />
            <SummaryRow
              label="Pay cycle budget"
              value={formatCurrency(budgetSettings.payCycleBudget)}
            />
            <SummaryRow
              label="Credit card debt"
              value={formatCurrency(-calculations.creditCardDebt)}
              negative={calculations.creditCardDebt > 0}
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
              label="Daily budget"
              value={formatCurrency(calculations.dailyBudget)}
              negative={calculations.dailyBudget < 0}
            />
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
          </div>
        </div>

        <div className="grid border-t border-white/10 md:grid-cols-3">
          <SummaryRow
            label="Gross assets"
            value={formatCurrency(calculations.grossAssets)}
          />
          <SummaryRow
            label="Gross liabilities"
            value={formatCurrency(-calculations.creditCardDebt)}
            negative={calculations.creditCardDebt > 0}
          />
          <SummaryRow
            label="Net assets"
            value={formatCurrency(calculations.netAssets)}
            emphasized
            negative={calculations.netAssets < 0}
          />
        </div>

        <div className="border-t border-white/10">
          <SummaryRow
            label="Charge"
            value={formatCurrency(budgetSettings.charge)}
          />
        </div>
      </div>
    </section>
  );
}
