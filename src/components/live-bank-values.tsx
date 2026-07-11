"use client";

import {
  FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useOptionalBudgetData } from "@/components/budget-data-provider";
import { useLiveSnapshot } from "@/components/live-snapshot-provider";
import { APP_BASE_PATH } from "@/lib/config";
import type { CreditCardTransaction } from "@/lib/credit-card-transaction-types";
import { formatPayday, getNextPayCycle } from "@/lib/pay-cycle";
import type { BudgetPlanSettings } from "@/lib/budget-plan-settings-types";
import type { PendingTransaction } from "@/lib/pending-transaction-types";
import { getSavingsReservePosition } from "@/lib/savings-reserve";
import type { BankValueSnapshot } from "@/lib/snapshot-types";

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

const accountLoginUrls: Partial<
  Record<keyof BankValueSnapshot, string>
> = {
  chase_checking:
    "https://secure.chase.com/web/auth/dashboard#/dashboard/overview",
  chase_savings:
    "https://secure.chase.com/web/auth/dashboard#/dashboard/overview",
  chase_credit:
    "https://secure.chase.com/web/auth/dashboard#/dashboard/overview",
  citi_current: "https://online.citi.com/US/ag/dashboard/credit-card",
  barclays_card:
    "https://www.barclaycardus.com/servicing/accountSummaryOnLogin",
  etrade: "https://us.etrade.com/etx/pxy/portfolios/positions",
  betterment_general: "https://wwws.betterment.com/app",
  betterment_safety: "https://wwws.betterment.com/app",
  betterment_retirement: "https://wwws.betterment.com/app",
  fidelity_retirement:
    "https://workplaceservices.fidelity.com/mybenefits/navstation/navigation#/",
};

const transactionAccountFilters: Partial<
  Record<
    keyof BankValueSnapshot,
    { issuer: string; accountLastFour: string; includeUnbudgeted?: boolean }
  >
> = {
  chase_checking: {
    issuer: "Chase",
    accountLastFour: "0277",
    includeUnbudgeted: true,
  },
  chase_savings: {
    issuer: "Chase",
    accountLastFour: "3060",
    includeUnbudgeted: true,
  },
  chase_credit: { issuer: "Chase", accountLastFour: "9125" },
  citi_current: { issuer: "Citibank Online", accountLastFour: "4596" },
  barclays_card: { issuer: "Barclays - Cards", accountLastFour: "2028" },
};

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
  charge: 0,
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const compactDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function formatCurrency(value: string | number | undefined) {
  if (value === undefined) return "—";
  const number = Number(value);
  return Number.isFinite(number) ? currencyFormatter.format(number) : "—";
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

function EditableBudgetOffsetRow({
  value,
  draftValue,
  isEditing,
  isSaving,
  error,
  onBeginEdit,
  onCancel,
  onChangeDraft,
  onSubmit,
}: {
  value: number;
  draftValue: string;
  isEditing: boolean;
  isSaving: boolean;
  error: string;
  onBeginEdit: () => void;
  onCancel: () => void;
  onChangeDraft: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (isEditing) {
    return (
      <form
        className="border-b border-white/[0.07] bg-white/[0.025] px-4 py-4 last:border-b-0 sm:px-5"
        onSubmit={onSubmit}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_auto_auto] sm:items-end">
          <label className="min-w-0">
            <span className="mb-2 block text-sm font-medium text-white/70">
              Budget offset
            </span>
            <input
              autoFocus
              className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 font-mono text-sm text-white outline-none transition focus:border-accent/50"
              inputMode="decimal"
              onChange={(event) => onChangeDraft(event.target.value)}
              placeholder="0.00"
              type="text"
              value={draftValue}
            />
          </label>
          <button
            className="h-10 rounded-xl border border-accent/25 bg-accent/10 px-4 text-sm font-semibold text-accent transition hover:bg-accent/15"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Apply"}
          </button>
          <button
            className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
            disabled={isSaving}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">
          Use a positive offset to add money back, or a negative offset to
          remove costs covered elsewhere.
        </p>
        {error ? (
          <p
            className="mt-3 rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <button
      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-white/[0.07] px-4 py-3.5 text-left transition hover:bg-white/[0.04] focus:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/30 last:border-b-0 sm:px-5"
      onClick={onBeginEdit}
      type="button"
    >
      <span className="min-w-0 text-sm text-white/70">Budget offset</span>
      <span
        className={`whitespace-nowrap font-mono text-sm underline decoration-white/20 underline-offset-4 sm:text-base ${
          value < 0
            ? "font-semibold text-rose-300"
            : value > 0
              ? "font-semibold text-accent"
              : "text-white/90"
        }`}
      >
        {formatCurrency(value)}
      </span>
    </button>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon,
  featured = false,
  negative = false,
}: {
  label: string;
  value: string;
  description: ReactNode;
  icon?: ReactNode;
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
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {label}
        </p>
        {icon}
      </div>
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

function AccountLoginLink({
  accountKey,
  label,
}: {
  accountKey: keyof BankValueSnapshot;
  label: string;
}) {
  const href = accountLoginUrls[accountKey];
  if (!href) return null;

  return (
    <a
      aria-label={`Open ${label} in bank portal`}
      className="shrink-0 rounded p-0.5 text-white/30 transition hover:text-accent"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      title={`Open ${label}`}
    >
      <svg
        aria-hidden="true"
        className="size-3.5"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 20 4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </a>
  );
}

function AdjustedReserveCopyButton({
  copied,
  disabled,
  label,
  onClick,
}: {
  copied: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={`relative grid size-5 shrink-0 place-items-center rounded text-white/30 transition hover:text-accent disabled:cursor-not-allowed disabled:text-white/15 ${
        copied ? "text-accent" : ""
      }`}
      disabled={disabled}
      onClick={onClick}
      title={copied ? "Copied" : label}
      type="button"
    >
      <svg
        aria-hidden="true"
        className={`size-3.5 transition duration-200 ${
          copied ? "scale-50 opacity-0" : "scale-100 opacity-100"
        }`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M12 3v18M7 6h10M6 6l-3 7h6L6 6Zm12 0-3 7h6l-3-7ZM5 21h14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      <span
        aria-hidden="true"
        className={`absolute inset-0 rounded-full border border-accent/40 ${
          copied ? "animate-ping opacity-75" : "opacity-0"
        }`}
      />
      <svg
        aria-hidden="true"
        className={`absolute size-3.5 transition duration-200 ${
          copied ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
        fill="none"
        viewBox="0 0 16 16"
      >
        <path
          d="m3.2 8.2 2.8 2.8 6.8-6.9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
      </svg>
      <span className="sr-only">{copied ? "Copied" : label}</span>
    </button>
  );
}

function PaidActionButton({
  disabled,
  label,
  onClick,
  state,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  state: "idle" | "saving" | "paid";
}) {
  return (
    <button
      aria-label={label}
      className="relative grid h-9 w-9 min-w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-white/35 transition hover:border-accent/25 hover:bg-accent/10 hover:text-accent disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-transparent disabled:text-white/18"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <span className="font-mono text-sm font-semibold">$</span>
      <svg
        aria-hidden="true"
        className={`absolute right-1.5 top-1.5 size-3 ${
          state === "paid" ? "text-accent" : "text-current"
        }`}
        fill="none"
        viewBox="0 0 16 16"
      >
        <path
          d="m3.2 8.2 2.8 2.8 6.8-6.9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
      </svg>
      <span className="sr-only">
        {state === "paid" ? "Paid" : state === "saving" ? "Saving" : "Mark paid"}
      </span>
    </button>
  );
}

function formatTransactionDate(value: string | null | undefined) {
  if (!value) return "No post date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return compactDateFormatter.format(date);
}

function signedTransactionAmount(transaction: CreditCardTransaction) {
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount)) return "—";
  const sign =
    transaction.transaction_type === "payment" ||
    transaction.transaction_type === "credit"
      ? -1
      : 1;
  return formatCurrency(amount * sign);
}

function AccountTransactionToggle({
  accountLabel,
  isExpanded,
  onClick,
}: {
  accountLabel: string;
  isExpanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-expanded={isExpanded}
      aria-label={`${isExpanded ? "Hide" : "Show"} ${accountLabel} transactions`}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-base leading-none text-white/60 transition hover:border-accent/35 hover:bg-accent/10 hover:text-accent"
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true" className="-mt-px">
        {isExpanded ? "−" : "+"}
      </span>
    </button>
  );
}

function AccountTransactionList({
  error,
  isLoading,
  transactions,
}: {
  error: string;
  isLoading: boolean;
  transactions: CreditCardTransaction[];
}) {
  const pending = transactions.filter((transaction) => transaction.pending);
  const posted = transactions.filter((transaction) => !transaction.pending);

  function transactionRows(items: CreditCardTransaction[]) {
    if (!items.length) {
      return (
        <p className="rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-muted">
          No transactions found.
        </p>
      );
    }

    return (
      <div className="overflow-hidden rounded-xl border border-white/10">
        {items.map((transaction) => {
          const isCredit =
            transaction.transaction_type === "payment" ||
            transaction.transaction_type === "credit";
          return (
            <div
              className="grid grid-cols-[4rem_minmax(0,1fr)_auto] gap-3 border-b border-white/[0.07] px-3 py-2.5 last:border-b-0"
              key={transaction.id}
            >
              <span className="text-xs text-muted">
                {formatTransactionDate(
                  transaction.posting_date || transaction.transaction_date,
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-white/80">
                  {transaction.description}
                </p>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-muted">
                  {transaction.category || transaction.transaction_type}
                </p>
              </div>
              <span
                className={`whitespace-nowrap text-right font-mono text-sm ${
                  isCredit ? "text-accent" : "text-white"
                }`}
              >
                {signedTransactionAmount(transaction)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="col-span-full border-b border-white/[0.07] bg-black/10 px-4 py-4 sm:px-5">
      {isLoading ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-muted">
          Loading recent transactions…
        </p>
      ) : error ? (
        <p
          className="rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 py-3 text-sm text-rose-100"
          role="alert"
        >
          {error}
        </p>
      ) : (
        <div className="grid gap-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
                Pending
              </p>
              <span className="text-xs text-muted">{pending.length}</span>
            </div>
            {transactionRows(pending)}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">
                Posted
              </p>
              <span className="text-xs text-muted">{posted.length}</span>
            </div>
            {transactionRows(posted)}
          </div>
        </div>
      )}
    </div>
  );
}

export function LiveBankValues({
  initialBudgetPlanSettings,
  initialPendingTransactions,
  view = "overview",
}: {
  initialBudgetPlanSettings?: BudgetPlanSettings;
  initialPendingTransactions?: PendingTransaction[];
  view?: FinancialView;
}) {
  const budgetData = useOptionalBudgetData();
  const { snapshot } = useLiveSnapshot();
  const [localPendingTransactions, setLocalPendingTransactions] = useState(
    initialPendingTransactions ?? [],
  );
  const pendingTransactions =
    budgetData?.pendingTransactions ?? localPendingTransactions;
  const setPendingTransactions =
    budgetData?.setPendingTransactions ?? setLocalPendingTransactions;
  const budgetPlanSettings =
    budgetData?.budgetPlanSettings ?? initialBudgetPlanSettings;

  if (!budgetPlanSettings) {
    throw new Error(
      "LiveBankValues requires budget plan settings from props or BudgetDataProvider.",
    );
  }
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [payingAccount, setPayingAccount] =
    useState<keyof BankValueSnapshot | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedAccount, setExpandedAccount] =
    useState<keyof BankValueSnapshot | null>(null);
  const [accountTransactions, setAccountTransactions] = useState<
    Partial<
      Record<
        keyof BankValueSnapshot,
        {
          isLoading: boolean;
          error: string;
          transactions: CreditCardTransaction[];
        }
      >
    >
  >({});
  const [transactionForm, setTransactionForm] = useState({
    note: "",
    amount: "",
    account: "chase_checking" as keyof BankValueSnapshot,
    expected_post_date: nextBusinessDayString(),
  });
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const initialBudgetOffset = Number(budgetPlanSettings.budget_offset);
  const [budgetOffset, setBudgetOffset] = useState(
    Number.isFinite(initialBudgetOffset) ? initialBudgetOffset : 0,
  );
  const [budgetOffsetDraft, setBudgetOffsetDraft] = useState(
    (Number.isFinite(initialBudgetOffset) ? initialBudgetOffset : 0).toFixed(2),
  );
  const [isBudgetOffsetEditing, setIsBudgetOffsetEditing] = useState(false);
  const [budgetOffsetError, setBudgetOffsetError] = useState("");
  const [isBudgetOffsetSaving, setIsBudgetOffsetSaving] = useState(false);
  const [copiedAdjustedAccount, setCopiedAdjustedAccount] =
    useState<keyof BankValueSnapshot | null>(null);
  const payCycle = getNextPayCycle(
    currentDate,
    budgetPlanSettings.next_payday_override,
  );

  useEffect(() => {
    const refreshDate = window.setInterval(
      () => setCurrentDate(new Date()),
      60 * 1000,
    );

    return () => window.clearInterval(refreshDate);
  }, []);

  const calculations = useMemo(() => {
    const pendingByAccount = new Map<keyof BankValueSnapshot, number>();
    const settledAccounts = new Set<keyof BankValueSnapshot>();
    for (const transaction of pendingTransactions) {
      if (transaction.is_cleared) continue;
      for (const account of transaction.settled_accounts || []) {
        settledAccounts.add(account);
      }
      pendingByAccount.set(
        transaction.account,
        (pendingByAccount.get(transaction.account) || 0) +
          Number(transaction.amount),
      );
    }

    const adjustedValue = (key: keyof BankValueSnapshot) => {
      const posted = valueFromSnapshot(snapshot, key);
      if (settledAccounts.has(key) && key !== "citi_pending") return 0;
      const pending = pendingByAccount.get(key) || 0;
      return liabilityAccounts.has(key) ? posted + pending : posted - pending;
    };

    const chaseChecking = adjustedValue("chase_checking");
    const chaseSavings = adjustedValue("chase_savings");
    const savingsReserve = getSavingsReservePosition(chaseSavings);
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
    const remainingBudget = budgetDifference + budgetOffset;
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
      checkingAvailable: chaseChecking,
      savingsReserve,
      netAssets: grossAssets - grossLiabilities,
      pendingByAccount,
      settledAccounts,
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
  }, [budgetOffset, payCycle.daysRemaining, pendingTransactions, snapshot]);

  function beginBudgetOffsetEdit() {
    setBudgetOffsetDraft(budgetOffset.toFixed(2));
    setBudgetOffsetError("");
    setIsBudgetOffsetEditing(true);
  }

  function cancelBudgetOffsetEdit() {
    setBudgetOffsetDraft(budgetOffset.toFixed(2));
    setBudgetOffsetError("");
    setIsBudgetOffsetEditing(false);
  }

  async function saveBudgetOffset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedDraft = budgetOffsetDraft.replace(/[$,\s]/g, "");
    const nextValue = Number(normalizedDraft);

    if (!Number.isFinite(nextValue)) {
      setBudgetOffsetError("Enter a valid positive or negative dollar amount.");
      return;
    }

    setIsBudgetOffsetSaving(true);
    setBudgetOffsetError("");

    try {
      const response = await fetch(`${APP_BASE_PATH}/api/budget-plan-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget_offset: nextValue.toFixed(2) }),
      });
      const data = (await response.json().catch(() => null)) as
        | BudgetPlanSettings
        | { message?: string; detail?: string; [key: string]: unknown }
        | null;
      if (!response.ok || !data || !("budget_offset" in data)) {
        throw new Error(
          (data && "message" in data && data.message) ||
            (data && "detail" in data && data.detail) ||
            "Unable to save the budget offset.",
        );
      }

      const savedValue = Number(data.budget_offset);
      const normalizedSavedValue = Number.isFinite(savedValue) ? savedValue : 0;
      setBudgetOffset(normalizedSavedValue);
      setBudgetOffsetDraft(normalizedSavedValue.toFixed(2));
      setIsBudgetOffsetEditing(false);
      budgetData?.setBudgetPlanSettings(data as BudgetPlanSettings);
    } catch (error) {
      setBudgetOffsetError(
        error instanceof Error
          ? error.message
          : "Unable to save the budget offset.",
      );
    } finally {
      setIsBudgetOffsetSaving(false);
    }
  }

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

  async function markLiabilityPaid({
    amount,
    settledAccounts,
  }: {
    amount: number;
    settledAccounts: Array<keyof BankValueSnapshot>;
  }) {
    const roundedAmount = Math.max(0, amount);
    if (roundedAmount <= 0 || !settledAccounts.length) return;

    setRegisterError("");
    setPayingAccount(settledAccounts[0]);

    try {
      const response = await fetch(`${APP_BASE_PATH}/api/pending-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: "chase_checking",
          note: "Credit Card Payment",
          amount: roundedAmount.toFixed(2),
          expected_post_date: nextBusinessDayString(),
          settled_accounts: settledAccounts,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | PendingTransaction
        | { message?: string; detail?: string; [key: string]: unknown }
        | null;
      if (!response.ok || !data || !("id" in data)) {
        throw new Error(
          (data && "message" in data && data.message) ||
            (data && "detail" in data && data.detail) ||
            "Unable to mark the liability account paid.",
        );
      }
      setPendingTransactions((current) => [data as PendingTransaction, ...current]);
    } catch (error) {
      setRegisterError(
        error instanceof Error
          ? error.message
          : "Unable to mark the liability account paid.",
      );
    } finally {
      setPayingAccount(null);
    }
  }

  async function copyAdjustedReserveValue(
    accountKey: keyof BankValueSnapshot,
    adjustedValue: number,
  ) {
    setRegisterError("");

    try {
      await navigator.clipboard.writeText((adjustedValue - 500).toFixed(2));
      setCopiedAdjustedAccount(accountKey);
      window.setTimeout(() => {
        setCopiedAdjustedAccount((current) =>
          current === accountKey ? null : current,
        );
      }, 1800);
    } catch {
      setRegisterError("Unable to copy the adjusted total.");
    }
  }

  async function loadAccountTransactions(accountKey: keyof BankValueSnapshot) {
    const filters = transactionAccountFilters[accountKey];
    if (!filters) return;

    setAccountTransactions((current) => ({
      ...current,
      [accountKey]: {
        isLoading: true,
        error: "",
        transactions: current[accountKey]?.transactions || [],
      },
    }));

    try {
      const params = new URLSearchParams({
        issuer: filters.issuer,
        account_last_four: filters.accountLastFour,
        limit: "60",
      });
      if (filters.includeUnbudgeted) {
        params.set("include_unbudgeted", "true");
      }
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => null)) as
        | CreditCardTransaction[]
        | { message?: string; detail?: string }
        | null;
      if (!response.ok || !Array.isArray(data)) {
        throw new Error(
          (data && !Array.isArray(data) && (data.message || data.detail)) ||
            "Unable to load account transactions.",
        );
      }
      setAccountTransactions((current) => ({
        ...current,
        [accountKey]: {
          isLoading: false,
          error: "",
          transactions: data,
        },
      }));
    } catch (error) {
      setAccountTransactions((current) => ({
        ...current,
        [accountKey]: {
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load account transactions.",
          transactions: current[accountKey]?.transactions || [],
        },
      }));
    }
  }

  function toggleAccountTransactions(accountKey: keyof BankValueSnapshot) {
    const nextAccount = expandedAccount === accountKey ? null : accountKey;
    setExpandedAccount(nextAccount);
    if (nextAccount && !accountTransactions[nextAccount]) {
      void loadAccountTransactions(nextAccount);
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

  return (
    <section>
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

          {calculations.savingsReserve.variance < 0 ? (
            <div
              className="rounded-2xl border border-amber-200/25 bg-amber-300/10 p-5"
              role="alert"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">
                Savings reserve shortfall
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-50/80">
                Chase Savings is{" "}
                <span className="font-semibold text-amber-50">
                  {formatCurrency(
                    calculations.savingsReserve.restorationNeeded,
                  )}
                </span>{" "}
                below the {formatCurrency(calculations.savingsReserve.target)}{" "}
                reserve target.
              </p>
            </div>
          ) : null}

          {budgetOffset !== 0 ? (
            <div
              className="rounded-2xl border border-accent/25 bg-accent/10 p-5"
              role="status"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Budget offset enabled
              </p>
              <p className="mt-2 text-sm leading-6 text-accent/85">
                Remaining budget is adjusted by{" "}
                <span className="font-semibold text-accent">
                  {formatCurrency(budgetOffset)}
                </span>
                .
              </p>
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
            <MetricCard
              label="Snapshot"
              value={formatCurrency(snapshot?.change)}
              icon={
                snapshot?.is_highpoint ? (
                  <span
                    aria-label="Highpoint"
                    className="grid size-8 shrink-0 place-items-center rounded-full border border-gold/25 bg-gold/10 text-gold"
                    title="Highpoint"
                  >
                    <svg
                      aria-hidden="true"
                      className="size-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M8 4h8v3.5a4 4 0 0 1-8 0V4Zm0 2H5.5v1.5A3.5 3.5 0 0 0 9 11m7-5h2.5v1.5A3.5 3.5 0 0 1 15 11m-3 .5V16m-3 4h6m-5-4h4v4h-4v-4Z"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.7"
                      />
                    </svg>
                  </span>
                ) : undefined
              }
              description={
                <>
                  <span>
                    Since last highpoint:{" "}
                    {formatCurrency(
                      -Math.abs(Number(snapshot?.loss_since_highpoint || 0)),
                    )}{" "}
                    ({(-Math.abs(
                      Number(snapshot?.loss_since_highpoint_percentage || 0),
                    )).toFixed(2)}
                    %)
                  </span>
                </>
              }
              negative={Number(snapshot?.change || 0) < 0}
            />
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
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Current balances
            </p>
            <p className="mt-1 text-sm text-muted">
              Adjusted balances include uncleared manual transactions.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
            <div className="grid gap-5">
              {accountSections.map((section) => (
                <section
                  key={section.title}
                  className="surface flex flex-col overflow-hidden rounded-2xl"
                >
                <div className="border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.17em] text-gold">
                      {section.title}
                    </h3>
                    <p className="text-xs text-muted">{section.description}</p>
                  </div>
                </div>
                <div
                  className={`hidden gap-6 border-b border-white/10 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted sm:grid ${
                    section.title === "Investments & retirement"
                      ? "grid-cols-[minmax(0,1fr)_8rem]"
                      : "grid-cols-[minmax(0,1fr)_8rem_8rem_8rem]"
                  }`}
                >
                  <span>Account</span>
                  {section.title === "Investments & retirement" ? (
                    <span className="text-right">Available</span>
                  ) : (
                    <>
                      <span className="text-right">Available</span>
                      <span className="text-right">Pending</span>
                      <span className="text-right">Adjusted</span>
                    </>
                  )}
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
                const totalPending =
                  pendingPosted + currentManual + pendingManual;
                const adjusted =
                  calculations.adjustedValue("citi_current") +
                  calculations.adjustedValue("citi_pending");
                const citiSettled =
                  calculations.settledAccounts.has("citi_current");

                const citiTransactions = accountTransactions.citi_current;
                const citiExpanded = expandedAccount === "citi_current";
                return (
                  <div key="citi_card">
                    <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-x-5 border-b border-white/[0.07] px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem] sm:px-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <AccountTransactionToggle
                          accountLabel="Citi Card"
                          isExpanded={citiExpanded}
                          onClick={() => toggleAccountTransactions("citi_current")}
                        />
                        <span className="text-sm text-white/75">Citi Card</span>
                        <AccountLoginLink
                          accountKey="citi_current"
                          label="Citi Card"
                        />
                        <PaidActionButton
                          disabled={
                            citiSettled || currentPosted <= 0 || !!payingAccount
                          }
                          label={
                            citiSettled
                              ? "Citi Card is paid pending clearance"
                              : "Mark Citi Card paid"
                          }
                          onClick={() =>
                            markLiabilityPaid({
                              amount: currentPosted,
                              settledAccounts: ["citi_current"],
                            })
                          }
                          state={
                            citiSettled
                              ? "paid"
                              : payingAccount === "citi_current"
                                ? "saving"
                                : "idle"
                          }
                        />
                      </div>
                      {citiSettled ? (
                        <p className="mt-1 text-xs text-accent">
                          Paid pending clearance
                        </p>
                      ) : null}
                    </div>
                    <span className="hidden whitespace-nowrap text-right font-mono text-sm text-white/55 sm:block">
                      {formatCurrency(currentPosted)}
                    </span>
                    <span className="hidden whitespace-nowrap text-right font-mono text-sm text-amber-100/70 sm:block">
                      {formatCurrency(totalPending)}
                    </span>
                    <div className="text-right">
                      <p className="whitespace-nowrap font-mono text-sm font-semibold text-white">
                        {formatCurrency(adjusted)}
                      </p>
                    </div>
                    </div>
                    {citiExpanded ? (
                      <AccountTransactionList
                        error={citiTransactions?.error || ""}
                        isLoading={citiTransactions?.isLoading ?? true}
                        transactions={citiTransactions?.transactions || []}
                      />
                    ) : null}
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
                  const liabilitySettled = calculations.settledAccounts.has(
                    account.key,
                  );
                  const isInvestmentSection =
                    section.title === "Investments & retirement";
                  const canShowTransactions = Boolean(
                    transactionAccountFilters[account.key],
                  );
                  const isExpanded = expandedAccount === account.key;
                  const transactionState = accountTransactions[account.key];
                  return (
                    <div key={account.key}>
                      <div
                        className={`grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-x-5 gap-y-1 border-b px-4 py-3.5 sm:px-5 ${
                          isInvestmentSection
                            ? "sm:grid-cols-[minmax(0,1fr)_8rem]"
                            : "sm:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem]"
                        } ${
                          overdrawn
                            ? "border-rose-300/15 bg-rose-500/10"
                            : "border-white/[0.07]"
                        }`}
                      >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {canShowTransactions ? (
                            <AccountTransactionToggle
                              accountLabel={account.label}
                              isExpanded={isExpanded}
                              onClick={() =>
                                toggleAccountTransactions(account.key)
                              }
                            />
                          ) : null}
                          <span
                            className={`shrink-0 whitespace-nowrap text-sm ${
                              overdrawn
                                ? "font-semibold text-rose-200"
                                : "text-white/75"
                            }`}
                          >
                            {account.label}
                          </span>
                          <AccountLoginLink
                            accountKey={account.key}
                            label={account.label}
                          />
                          {account.key === "chase_checking" ? (
                            <AdjustedReserveCopyButton
                              copied={
                                copiedAdjustedAccount === "chase_checking"
                              }
                              disabled={!snapshot}
                              label="Copy Chase Checking adjusted total minus $500"
                              onClick={() =>
                                copyAdjustedReserveValue(account.key, adjusted)
                              }
                            />
                          ) : null}
                          {compactLiability ? (
                            <PaidActionButton
                              disabled={
                                liabilitySettled ||
                                posted <= 0 ||
                                !!payingAccount
                              }
                              label={
                                liabilitySettled
                                  ? `${account.label} is paid pending clearance`
                                  : `Mark ${account.label} paid`
                              }
                              onClick={() =>
                                markLiabilityPaid({
                                  amount: posted,
                                  settledAccounts: [account.key],
                                })
                              }
                              state={
                                liabilitySettled
                                  ? "paid"
                                  : payingAccount === account.key
                                    ? "saving"
                                    : "idle"
                              }
                            />
                          ) : null}
                        </div>
                        {liabilitySettled ? (
                          <p className="mt-1 text-xs text-accent">
                            Paid pending clearance
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`whitespace-nowrap text-right font-mono text-sm text-white/55 ${
                          isInvestmentSection ? "block" : "hidden sm:block"
                        }`}
                      >
                        {formatCurrency(posted)}
                      </span>
                      {!isInvestmentSection ? (
                        <>
                          <span className="hidden whitespace-nowrap text-right font-mono text-sm text-amber-100/70 sm:block">
                            {formatCurrency(pending)}
                          </span>
                          <div className="text-right">
                            <p
                              className={`whitespace-nowrap font-mono text-sm font-semibold ${
                                overdrawn ? "text-rose-300" : "text-white"
                              }`}
                            >
                              {formatCurrency(adjusted)}
                            </p>
                          </div>
                        </>
                      ) : null}
                      </div>
                      {isExpanded ? (
                        <AccountTransactionList
                          error={transactionState?.error || ""}
                          isLoading={transactionState?.isLoading ?? true}
                          transactions={transactionState?.transactions || []}
                        />
                      ) : null}
                    </div>
                  );
                })}
                <div
                  className={`mt-auto grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-5 bg-white/[0.04] px-4 py-3.5 sm:px-5 ${
                    section.title === "Investments & retirement"
                      ? "sm:grid-cols-[minmax(0,1fr)_8rem]"
                      : "sm:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem]"
                  }`}
                >
                  <span className="text-sm font-semibold text-white">
                    Total {section.title.toLowerCase()}
                  </span>
                  {section.title !== "Investments & retirement" ? (
                    <>
                      <span aria-hidden="true" className="hidden sm:block" />
                      <span aria-hidden="true" className="hidden sm:block" />
                    </>
                  ) : null}
                  <span
                    className={`whitespace-nowrap text-right font-mono text-sm font-semibold ${
                      section.title === "Liability accounts"
                        ? "text-rose-200"
                        : "text-accent"
                    }`}
                  >
                    {formatCurrency(
                      (section.totalKeys || section.keys).reduce(
                        (total, key) =>
                          total +
                          (section.title === "Investments & retirement"
                            ? valueFromSnapshot(snapshot, key)
                            : calculations.adjustedValue(key)),
                        0,
                      ),
                    )}
                  </span>
                </div>
                </section>
              ))}
            </div>

            <div>
              <div className="surface overflow-hidden rounded-2xl">
                <div className="border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                    Pending transaction register
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Mark a transaction cleared once it appears in the posted
                    bank balance.
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
                    className={`grid gap-3 border-b border-white/[0.07] px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_6.5rem_12rem] sm:items-center sm:px-5 ${
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
                    <span className="whitespace-nowrap text-right font-mono text-sm font-semibold text-white">
                      {formatCurrency(transaction.amount)}
                    </span>
                    <div className="flex flex-wrap items-center justify-start gap-2 sm:flex-nowrap sm:justify-end">
                      {transaction.is_cleared ? (
                        <span className="w-20 text-center text-xs font-medium text-accent">
                          Cleared
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markCleared(transaction)}
                          className="w-20 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/70 transition hover:border-accent/30 hover:text-accent"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onBlur={() =>
                          window.setTimeout(() => {
                            setConfirmingDeleteId((current) =>
                              current === transaction.id ? null : current,
                            );
                          }, 0)
                        }
                        onClick={() => {
                          if (confirmingDeleteId === transaction.id) {
                            deleteTransaction(transaction);
                            return;
                          }
                          setConfirmingDeleteId(transaction.id);
                        }}
                        disabled={deletingId === transaction.id}
                        className={`w-20 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
                          confirmingDeleteId === transaction.id
                            ? "border-rose-300/35 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                            : "border-rose-300/15 text-rose-200/80 hover:border-rose-300/35 hover:bg-rose-500/10 hover:text-rose-100"
                        }`}
                      >
                        {deletingId === transaction.id
                          ? "Deleting…"
                          : confirmingDeleteId === transaction.id
                            ? "Confirm"
                            : "Delete"}
                      </button>
                    </div>
                  </div>
                );
                  })
                ) : (
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    No pending transactions.
                  </p>
                )}
                <div className="border-t border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <button
                    type="button"
                    onClick={() => setFormOpen((open) => !open)}
                    className="ml-auto block rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/15"
                  >
                    {formOpen ? "Cancel" : "Add pending transaction"}
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
                              account: event.target
                                .value as keyof BankValueSnapshot,
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
                        Enter outgoing amounts as positive values. Cash and
                        investment balances are reduced; credit-card balances
                        are increased.
                      </p>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
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
            <EditableBudgetOffsetRow
              draftValue={budgetOffsetDraft}
              error={budgetOffsetError}
              isEditing={isBudgetOffsetEditing}
              isSaving={isBudgetOffsetSaving}
              onBeginEdit={beginBudgetOffsetEdit}
              onCancel={cancelBudgetOffsetEdit}
              onChangeDraft={setBudgetOffsetDraft}
              onSubmit={saveBudgetOffset}
              value={budgetOffset}
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
              label="Savings reserve variance"
              value={formatCurrency(calculations.savingsReserve.variance)}
              negative={calculations.savingsReserve.variance < 0}
            />
            <SummaryRow
              label="Checking available"
              value={formatCurrency(calculations.checkingAvailable)}
              emphasized
              negative={calculations.checkingAvailable < 0}
            />
            </div>
          </div>

        </div>
      ) : null}
    </section>
  );
}
