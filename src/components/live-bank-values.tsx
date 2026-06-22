"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { APP_BASE_PATH } from "@/lib/config";
import type { BudgetItem } from "@/lib/budget-item-types";
import {
  amountForBudgetPeriod,
  budgetPeriods,
  monthlyAmountFromBudgetPeriod,
  type BudgetPeriod,
} from "@/lib/budget-periods";
import { formatPayday, getNextPayCycle } from "@/lib/pay-cycle";
import type { PendingTransaction } from "@/lib/pending-transaction-types";
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

const liabilityAccounts = new Set<keyof BankValueSnapshot>([
  "chase_credit",
  "citi_current",
  "citi_pending",
  "barclays_card",
]);

const accountSections: Array<{
  title: string;
  description: string;
  keys: Array<keyof BankValueSnapshot>;
  totalKeys?: Array<keyof BankValueSnapshot>;
}> = [
  {
    title: "Cash accounts",
    description: "Checking and savings",
    keys: ["chase_checking", "chase_savings"],
  },
  {
    title: "Liability accounts",
    description: "Credit-card balances and pending charges",
    keys: ["chase_credit", "citi_current", "barclays_card"],
    totalKeys: [
      "chase_credit",
      "citi_current",
      "citi_pending",
      "barclays_card",
    ],
  },
  {
    title: "Investments & retirement",
    description: "Taxable and retirement portfolios",
    keys: [
      "etrade",
      "betterment_general",
      "betterment_safety",
      "betterment_retirement",
      "fidelity_retirement",
    ],
  },
];

const budgetSettings = {
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

function nextBusinessDayString() {
  const candidate = new Date();
  candidate.setDate(candidate.getDate() + 1);
  while (candidate.getDay() === 0 || candidate.getDay() === 6) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return [
    candidate.getFullYear(),
    String(candidate.getMonth() + 1).padStart(2, "0"),
    String(candidate.getDate()).padStart(2, "0"),
  ].join("-");
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
  initialPendingTransactions,
  initialBudgetItems = [],
  view = "overview",
}: {
  initialSnapshot: BankValueSnapshot | null;
  initialPendingTransactions: PendingTransaction[];
  initialBudgetItems?: BudgetItem[];
  view?: FinancialView;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [pendingTransactions, setPendingTransactions] = useState(
    initialPendingTransactions,
  );
  const [budgetItems, setBudgetItems] = useState(initialBudgetItems);
  const [editingBudgetCell, setEditingBudgetCell] = useState<string | null>(
    null,
  );
  const [budgetInputValue, setBudgetInputValue] = useState("");
  const [savingBudgetItemId, setSavingBudgetItemId] = useState<number | null>(
    null,
  );
  const [budgetError, setBudgetError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [transactionForm, setTransactionForm] = useState({
    note: "",
    amount: "",
    account: "chase_checking" as keyof BankValueSnapshot,
    expected_post_date: nextBusinessDayString(),
  });
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const payCycle = getNextPayCycle(currentDate);

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

  useEffect(() => {
    const refreshDate = window.setInterval(
      () => setCurrentDate(new Date()),
      60 * 1000,
    );

    return () => window.clearInterval(refreshDate);
  }, []);

  const calculations = useMemo(() => {
    const pendingByAccount = new Map<keyof BankValueSnapshot, number>();
    for (const transaction of pendingTransactions) {
      if (transaction.is_cleared) continue;
      pendingByAccount.set(
        transaction.account,
        (pendingByAccount.get(transaction.account) || 0) +
          Number(transaction.amount),
      );
    }

    const adjustedValue = (key: keyof BankValueSnapshot) => {
      const posted = valueFromSnapshot(snapshot, key);
      const pending = pendingByAccount.get(key) || 0;
      return liabilityAccounts.has(key) ? posted + pending : posted - pending;
    };

    const chaseChecking = adjustedValue("chase_checking");
    const chaseSavings = adjustedValue("chase_savings");
    const grossLiabilities =
      adjustedValue("chase_credit") +
      adjustedValue("citi_current") +
      adjustedValue("citi_pending") +
      adjustedValue("barclays_card");
    const nonRetirementCash =
      chaseChecking +
      chaseSavings +
      adjustedValue("etrade") +
      adjustedValue("betterment_general") +
      adjustedValue("betterment_safety");
    const retirementCash =
      adjustedValue("betterment_retirement") +
      adjustedValue("fidelity_retirement");
    const grossAssets = nonRetirementCash + retirementCash;
    const budgetDifference = budgetSettings.totalBudget - grossLiabilities;
    const remainingBudget = budgetDifference + budgetSettings.budgetOffset;
    const dailyBudget =
      payCycle.daysRemaining > 0
        ? remainingBudget / payCycle.daysRemaining
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
      pendingByAccount,
      adjustedValue,
      overdrawnAccounts: accounts
        .filter(
          (account) =>
            !liabilityAccounts.has(account.key) &&
            adjustedValue(account.key) < 0,
        )
        .map((account) => ({
          ...account,
          adjustedBalance: adjustedValue(account.key),
        })),
    };
  }, [payCycle.daysRemaining, pendingTransactions, snapshot]);

  async function addPendingTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setIsSaving(true);

    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/pending-transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transactionForm),
        },
      );
      const data = (await response.json().catch(() => null)) as
        | PendingTransaction
        | { message?: string; detail?: string; [key: string]: unknown }
        | null;
      if (!response.ok || !data || !("id" in data)) {
        throw new Error(
          (data && "message" in data && data.message) ||
            (data && "detail" in data && data.detail) ||
            "Unable to save the pending transaction.",
        );
      }

      const savedTransaction = data as PendingTransaction;
      setPendingTransactions((current) => [savedTransaction, ...current]);
      setTransactionForm({
        note: "",
        amount: "",
        account: "chase_checking",
        expected_post_date: nextBusinessDayString(),
      });
      setFormOpen(false);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to save the pending transaction.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function budgetCellKey(itemId: number, period: BudgetPeriod) {
    return `${itemId}:${period}`;
  }

  function beginBudgetEdit(item: BudgetItem, period: BudgetPeriod) {
    setEditingBudgetCell(budgetCellKey(item.id, period));
    setBudgetInputValue(
      amountForBudgetPeriod(Number(item.monthly_amount), period).toFixed(2),
    );
    setBudgetError("");
  }

  function updateBudgetInput(
    itemId: number,
    period: BudgetPeriod,
    value: string,
  ) {
    setBudgetInputValue(value);
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;

    const monthlyAmount = monthlyAmountFromBudgetPeriod(amount, period);
    setBudgetItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, monthly_amount: monthlyAmount.toFixed(6) }
          : item,
      ),
    );
  }

  async function saveBudgetItem(itemId: number) {
    const item = budgetItems.find((candidate) => candidate.id === itemId);
    const amount = Number(budgetInputValue);
    if (!item || !Number.isFinite(amount) || amount < 0) {
      setBudgetError("Enter a valid amount of zero or more.");
      return;
    }

    setSavingBudgetItemId(itemId);
    setBudgetError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/budget-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthly_amount: item.monthly_amount }),
      });
      const updated = (await response.json().catch(() => null)) as
        | BudgetItem
        | { message?: string; monthly_amount?: string[] }
        | null;
      if (!response.ok || !updated || !("id" in updated)) {
        const message =
          updated && "message" in updated
            ? updated.message
            : updated && "monthly_amount" in updated
              ? updated.monthly_amount?.[0]
              : undefined;
        throw new Error(message || "Unable to save the budget amount.");
      }
      setBudgetItems((current) =>
        current.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
      setEditingBudgetCell(null);
    } catch (error) {
      setBudgetError(
        error instanceof Error
          ? error.message
          : "Unable to save the budget amount.",
      );
    } finally {
      setSavingBudgetItemId(null);
    }
  }

  async function markCleared(transaction: PendingTransaction) {
    setRegisterError("");
    const response = await fetch(
      `${APP_BASE_PATH}/api/pending-transactions/${transaction.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_cleared: true }),
      },
    );
    const updated = (await response.json().catch(() => null)) as
      | PendingTransaction
      | null;
    if (response.ok && updated?.id) {
      setPendingTransactions((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } else {
      setRegisterError("Unable to mark the transaction cleared.");
    }
  }

  async function deleteTransaction(transaction: PendingTransaction) {
    setRegisterError("");
    setDeletingId(transaction.id);

    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/pending-transactions/${transaction.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error("Unable to delete the pending transaction.");
      }
      setPendingTransactions((current) =>
        current.filter((item) => item.id !== transaction.id),
      );
      setConfirmingDeleteId(null);
    } catch (error) {
      setRegisterError(
        error instanceof Error
          ? error.message
          : "Unable to delete the pending transaction.",
      );
    } finally {
      setDeletingId(null);
    }
  }

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
        <div className="space-y-4">
          {calculations.overdrawnAccounts.length ? (
            <div
              className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-5"
              role="alert"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-200">
                Overdrawn account alert
              </p>
              <p className="mt-2 text-sm text-rose-100/80">
                {calculations.overdrawnAccounts.length === 1
                  ? "One account has a negative adjusted balance."
                  : `${calculations.overdrawnAccounts.length} accounts have negative adjusted balances.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {calculations.overdrawnAccounts.map((account) => (
                  <span
                    key={account.key}
                    className="rounded-full border border-rose-200/20 bg-black/10 px-3 py-1.5 text-xs font-medium text-rose-100"
                  >
                    {account.label}: {formatCurrency(account.adjustedBalance)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

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
              value={`${payCycle.daysRemaining}`}
              description={`Next payday: ${formatPayday(payCycle.nextPayday)}.`}
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
        </div>
      ) : null}

      {view === "accounts" ? (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Current balances
            </p>
            <p className="mt-1 text-sm text-muted">
              Adjusted balances include uncleared manual transactions.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {accountSections.map((section) => (
              <section
                key={section.title}
                className={`surface overflow-hidden rounded-2xl ${
                  section.title === "Investments & retirement"
                    ? "xl:col-span-2"
                    : ""
                }`}
              >
                <div className="border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.17em] text-gold">
                      {section.title}
                    </h3>
                    <p className="text-xs text-muted">{section.description}</p>
                  </div>
                </div>
                <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto] gap-6 border-b border-white/10 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted sm:grid">
                  <span>Account</span>
                  <span>Posted</span>
                  <span className="w-32 text-right">Adjusted</span>
                </div>
                {section.keys.map((accountKey) => {
                  const account = accounts.find(
                    (item) => item.key === accountKey,
                  );
                  if (!account) return null;

                  if (account.key === "citi_current") {
                const currentPosted = valueFromSnapshot(snapshot, "citi_current");
                const pendingPosted = valueFromSnapshot(snapshot, "citi_pending");
                const currentManual =
                  calculations.pendingByAccount.get("citi_current") || 0;
                const pendingManual =
                  calculations.pendingByAccount.get("citi_pending") || 0;
                const adjusted =
                  calculations.adjustedValue("citi_current") +
                  calculations.adjustedValue("citi_pending");

                return (
                  <div
                    key="citi_card"
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 border-b border-white/[0.07] px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-5"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-white/75">Citi Card</span>
                      <p className="mt-1 text-xs text-muted">
                        Current {formatCurrency(currentPosted)}
                        <span className="mx-1.5 text-white/20">·</span>
                        Pending {formatCurrency(pendingPosted)}
                        {currentManual + pendingManual > 0 ? (
                          <span className="text-amber-100/70">
                            {" "}
                            · {formatCurrency(currentManual + pendingManual)} manual
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <span className="hidden whitespace-nowrap font-mono text-sm text-white/55 sm:block">
                      {formatCurrency(currentPosted + pendingPosted)}
                    </span>
                    <span className="w-32 whitespace-nowrap text-right font-mono text-sm font-semibold text-white">
                      {formatCurrency(adjusted)}
                    </span>
                  </div>
                );
                  }

                  const posted = valueFromSnapshot(snapshot, account.key);
                  const pending =
                    calculations.pendingByAccount.get(account.key) || 0;
                  const adjusted = calculations.adjustedValue(account.key);
                  const overdrawn =
                    !liabilityAccounts.has(account.key) && adjusted < 0;
                  const compactLiability =
                    account.key === "chase_credit" ||
                    account.key === "barclays_card";
                  return (
                    <div
                      key={account.key}
                      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1 border-b px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-5 ${
                        overdrawn
                          ? "border-rose-300/15 bg-rose-500/10"
                          : "border-white/[0.07]"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`truncate text-sm ${
                              overdrawn
                                ? "font-semibold text-rose-200"
                                : "text-white/75"
                            }`}
                          >
                            {account.label}
                          </span>
                        </div>
                        {compactLiability ? (
                          <p className="mt-1 text-xs text-muted">
                            Current {formatCurrency(posted)}
                            <span className="mx-1.5 text-white/20">·</span>
                            Pending{" "}
                            <span
                              className={
                                pending > 0 ? "text-amber-100/70" : undefined
                              }
                            >
                              {formatCurrency(pending)}
                            </span>
                          </p>
                        ) : pending > 0 ? (
                          <p className="mt-1 text-xs text-amber-100/70">
                            {formatCurrency(pending)} pending
                          </p>
                        ) : null}
                      </div>
                      <span className="hidden whitespace-nowrap font-mono text-sm text-white/55 sm:block">
                        {formatCurrency(posted)}
                      </span>
                      <span
                        className={`w-32 whitespace-nowrap text-right font-mono text-sm font-semibold ${
                          overdrawn ? "text-rose-300" : "text-white"
                        }`}
                      >
                        {formatCurrency(adjusted)}
                      </span>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 bg-white/[0.04] px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-5">
                  <span className="text-sm font-semibold text-white">
                    Total {section.title.toLowerCase()}
                  </span>
                  <span className="hidden sm:block" />
                  <span
                    className={`w-32 whitespace-nowrap text-right font-mono text-sm font-semibold ${
                      section.title === "Liability accounts"
                        ? "text-rose-200"
                        : "text-accent"
                    }`}
                  >
                    {formatCurrency(
                      (section.totalKeys || section.keys).reduce(
                        (total, key) =>
                          total + calculations.adjustedValue(key),
                        0,
                      ),
                    )}
                  </span>
                </div>
              </section>
            ))}
          </div>

          <div className="surface overflow-hidden rounded-2xl">
            <div className="p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setFormOpen((open) => !open)}
                className="w-full rounded-xl bg-accent-strong px-4 py-2.5 text-sm font-semibold text-[#03120c] transition hover:bg-accent"
              >
                {formOpen ? "Cancel pending transaction" : "Add pending transaction"}
              </button>

              {formOpen ? (
                <form
                  onSubmit={addPendingTransaction}
                  className="mt-5 grid gap-4 sm:grid-cols-2"
                >
                  <label className="sm:col-span-2">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted">
                      Note
                    </span>
                    <input
                      value={transactionForm.note}
                      onChange={(event) =>
                        setTransactionForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-accent/50"
                      placeholder="What is this transaction for?"
                      maxLength={255}
                      required
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted">
                      Amount
                    </span>
                    <input
                      value={transactionForm.amount}
                      onChange={(event) =>
                        setTransactionForm((current) => ({
                          ...current,
                          amount: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 font-mono text-sm text-white outline-none focus:border-accent/50"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      required
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted">
                      Account
                    </span>
                    <select
                      value={transactionForm.account}
                      onChange={(event) =>
                        setTransactionForm((current) => ({
                          ...current,
                          account: event.target.value as keyof BankValueSnapshot,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1714] px-3 text-sm text-white outline-none focus:border-accent/50"
                    >
                      {accounts.map((account) => (
                        <option key={account.key} value={account.key}>
                          {account.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted">
                      Expected post date
                    </span>
                    <input
                      value={transactionForm.expected_post_date}
                      onChange={(event) =>
                        setTransactionForm((current) => ({
                          ...current,
                          expected_post_date: event.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-accent/50"
                      type="date"
                      required
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="h-11 w-full rounded-xl border border-accent/25 bg-accent/10 px-4 text-sm font-semibold text-accent transition hover:bg-accent/15 disabled:opacity-50"
                    >
                      {isSaving ? "Saving…" : "Save transaction"}
                    </button>
                  </div>
                  {formError ? (
                    <p
                      role="alert"
                      className="sm:col-span-2 rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                    >
                      {formError}
                    </p>
                  ) : null}
                  <p className="sm:col-span-2 text-xs leading-5 text-muted">
                    Enter outgoing amounts as positive values. Cash and investment
                    balances are reduced; credit-card balances are increased.
                  </p>
                </form>
              ) : null}
            </div>
          </div>

          <div className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Pending transaction register
              </p>
              <p className="mt-1 text-sm text-muted">
                Mark a transaction cleared once it appears in the posted bank
                balance.
              </p>
            </div>
            {registerError ? (
              <p
                className="border-b border-rose-300/15 bg-rose-500/10 px-5 py-3 text-sm text-rose-100"
                role="alert"
              >
                {registerError}
              </p>
            ) : null}
            {pendingTransactions.length ? (
              pendingTransactions.map((transaction) => {
                const account = accounts.find(
                  (item) => item.key === transaction.account,
                );
                return (
                  <div
                    key={transaction.id}
                    className={`grid gap-3 border-b border-white/[0.07] px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5 ${
                      transaction.is_cleared ? "opacity-45" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {transaction.note}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {account?.label || transaction.account} · Expected{" "}
                        {new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                        }).format(
                          new Date(
                            `${transaction.expected_post_date}T12:00:00`,
                          ),
                        )}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-white">
                      {formatCurrency(transaction.amount)}
                    </span>
                    <div className="flex items-center gap-2">
                      {transaction.is_cleared ? (
                        <span className="text-xs font-medium text-accent">
                          Cleared
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markCleared(transaction)}
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/70 transition hover:border-accent/30 hover:text-accent"
                        >
                          Mark cleared
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(transaction.id)}
                        hidden={confirmingDeleteId === transaction.id}
                        className="rounded-lg border border-rose-300/15 px-3 py-2 text-xs font-medium text-rose-200/80 transition hover:border-rose-300/35 hover:bg-rose-500/10 hover:text-rose-100"
                      >
                        Delete
                      </button>
                      {confirmingDeleteId === transaction.id ? (
                        <div className="flex items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-500/10 p-1">
                          <span className="px-2 text-xs text-rose-100">
                            Delete?
                          </span>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(null)}
                            disabled={deletingId === transaction.id}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTransaction(transaction)}
                            disabled={deletingId === transaction.id}
                            className="rounded-md bg-rose-500/20 px-2.5 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30 disabled:opacity-50"
                          >
                            {deletingId === transaction.id
                              ? "Deleting…"
                              : "Confirm delete"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted">
                No pending transactions.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {view === "budget" ? (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Budget plan
              </p>
            </div>
            <SummaryRow
              label="Days until next pay cycle"
              value={`${payCycle.daysRemaining} days`}
            />
            <SummaryRow
              label="Next payday"
              value={formatPayday(payCycle.nextPayday)}
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

          <div className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Recurring budget
              </p>
              <p className="mt-1 text-sm text-muted">
                Edit any period. The other periods and totals recalculate
                automatically using a four-week budgeting month.
              </p>
            </div>
            {budgetError ? (
              <p
                className="border-b border-rose-300/15 bg-rose-500/10 px-5 py-3 text-sm text-rose-100"
                role="alert"
              >
                {budgetError}
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[minmax(180px,1fr)_repeat(4,minmax(125px,0.5fr))] border-b border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  <span>Item</span>
                  <span className="text-right">Weekly</span>
                  <span className="text-right">Bi-Weekly</span>
                  <span className="text-right">Monthly</span>
                  <span className="text-right">Yearly</span>
                </div>
                {budgetItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(180px,1fr)_repeat(4,minmax(125px,0.5fr))] items-center border-b border-white/[0.07] px-5 py-2.5"
                  >
                    <span className="text-sm font-medium text-white/80">
                      {item.label}
                    </span>
                    {budgetPeriods.map((period) => {
                      const cellKey = budgetCellKey(item.id, period);
                      const editing = editingBudgetCell === cellKey;
                      return (
                        <div className="flex justify-end" key={period}>
                          <div className="relative w-28">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                              $
                            </span>
                            <input
                              aria-label={`${item.label} ${period}`}
                              className="h-9 w-full rounded-lg border border-transparent bg-transparent pl-7 pr-2 text-right font-mono text-sm text-white outline-none transition hover:border-white/10 hover:bg-white/[0.035] focus:border-accent/40 focus:bg-black/20 disabled:opacity-50"
                              disabled={savingBudgetItemId === item.id}
                              inputMode="decimal"
                              min="0"
                              onBlur={() => {
                                if (editing) void saveBudgetItem(item.id);
                              }}
                              onChange={(event) =>
                                updateBudgetInput(
                                  item.id,
                                  period,
                                  event.target.value,
                                )
                              }
                              onFocus={() => beginBudgetEdit(item, period)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.currentTarget.blur();
                                }
                                if (event.key === "Escape") {
                                  setBudgetItems(initialBudgetItems);
                                  setEditingBudgetCell(null);
                                  event.currentTarget.blur();
                                }
                              }}
                              step="0.01"
                              type="number"
                              value={
                                editing
                                  ? budgetInputValue
                                  : amountForBudgetPeriod(
                                      Number(item.monthly_amount),
                                      period,
                                    ).toFixed(2)
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div className="grid grid-cols-[minmax(180px,1fr)_repeat(4,minmax(125px,0.5fr))] items-center bg-white/[0.045] px-5 py-4">
                  <span className="text-sm font-semibold text-white">Total</span>
                  {budgetPeriods.map((period) => {
                    const totalMonthly = budgetItems.reduce(
                      (total, item) => total + Number(item.monthly_amount),
                      0,
                    );
                    return (
                      <span
                        className="text-right font-mono text-sm font-semibold text-accent"
                        key={period}
                      >
                        {formatCurrency(
                          amountForBudgetPeriod(totalMonthly, period),
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
