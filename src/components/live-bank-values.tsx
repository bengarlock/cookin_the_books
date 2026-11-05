"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useOptionalBudgetData } from "@/components/budget-data-provider";
import {
  hasActiveHomepageFinancialReminders,
  HomepageFinancialReminders,
} from "@/components/homepage-financial-reminders";
import { useLiveSnapshot } from "@/components/live-snapshot-provider";
import { OverviewFinancialBrief } from "@/components/overview-financial-brief";
import {
  accountTransactionDisplayAmount,
  manualPendingTransactionDisplayAmount,
} from "@/lib/account-transaction-display";
import {
  transactionAccountFilters,
  transactionsForAccount,
} from "@/lib/account-transaction-filters";
import { calculateAdjustedAccountBalances } from "@/lib/adjusted-account-balances";
import { APP_BASE_PATH } from "@/lib/config";
import type {
  CreditCardTransaction,
  ExpenseTag,
  PendingCardTransaction,
  SuggestedRelatedTransaction,
  TransactionSelectorRecord,
} from "@/lib/credit-card-transaction-types";
import type { ExpenseCategory } from "@/lib/expense-category-types";
import type {
  FinancialGoal,
} from "@/lib/financial-goal-types";
import type { FinancialReminder } from "@/lib/financial-reminder-types";
import type { IncomeEntry } from "@/lib/income-entry-types";
import { formatPayday, getNextPayCycle } from "@/lib/pay-cycle";
import { classifyPaychecks } from "@/lib/projections";
import type { BudgetPlanSettings } from "@/lib/budget-plan-settings-types";
import { pendingTransactionAmount } from "@/lib/pending-transaction-amount";
import type { PendingTransaction } from "@/lib/pending-transaction-types";
import { AmazonOrderDetails } from "@/components/amazon-order-details";
import { ReceiptOrderDetails } from "@/components/receipt-order-details";
import {
  accountLinkAccounts,
  accountDisplayName,
  accountLoginUrl,
  type AccountLoginUrls,
} from "@/lib/account-links";
import { getSavingsReservePosition } from "@/lib/savings-reserve";
import type { BankValueSnapshot, SnapshotAccountKey } from "@/lib/snapshot-types";
import { categoryLabelMap, sortedCategoryOptions } from "@/lib/transaction-categories";

type FinancialView = "overview" | "accounts" | "budget";
type AccountTransactionState = Partial<
  Record<
    SnapshotAccountKey,
    {
      isLoading: boolean;
      error: string;
      transactions: CreditCardTransaction[];
    }
  >
>;

const liabilityAccounts = new Set<SnapshotAccountKey>([
  "chase_credit",
  "chase_credit_8506",
  "citi_current",
  "citi_pending",
  "barclays_card",
]);

function initialAccountTransactionState(
  transactions: CreditCardTransaction[],
): AccountTransactionState {
  if (!transactions.length) return {};

  const state: AccountTransactionState = {};
  for (const accountKey of ["chase_credit", "chase_credit_8506", "citi_current", "barclays_card"] as const) {
    state[accountKey] = {
      isLoading: false,
      error: "",
      transactions: transactionsForAccount(transactions, accountKey),
    };
  }
  return state;
}

const accountSections: Array<{
  title: string;
  description: string;
  keys: SnapshotAccountKey[];
  totalKeys?: Array<SnapshotAccountKey>;
}> = [
  {
    title: "Cash accounts",
    description: "Checking and savings",
    keys: ["chase_checking", "chase_savings"],
  },
  {
    title: "Liability accounts",
    description: "Credit-card balances and pending charges",
    keys: ["chase_credit", "chase_credit_8506", "citi_current", "barclays_card"],
    totalKeys: [
      "chase_credit",
      "chase_credit_8506",
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
  if (!Number.isFinite(number)) return "—";
  const normalized = Math.abs(number) < 0.005 ? 0 : number;
  return currencyFormatter.format(normalized);
}

function valueFromSnapshot(
  snapshot: BankValueSnapshot | null,
  key: SnapshotAccountKey,
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

function AccountLoginLink({
  accountKey,
  label,
  urls,
}: {
  accountKey: SnapshotAccountKey;
  label: string;
  urls?: AccountLoginUrls;
}) {
  const href = accountLoginUrl(accountKey, urls);
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

function signedTransactionAmount(
  transaction: CreditCardTransaction,
  accountKey: SnapshotAccountKey,
) {
  const amount = accountTransactionDisplayAmount(transaction, accountKey);
  return amount === null ? "—" : formatCurrency(amount);
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
  accountKey,
  accountLabel,
  categories,
  confirmingDeleteId,
  deletingId,
  error,
  formError,
  formOpen,
  isLoading,
  isSaving,
  manualPendingTransactions,
  onChangeTransactionForm,
  onDeleteTransaction,
  onMarkCleared,
  onReconcile,
  onSubmitPendingTransaction,
  onTransactionUpdated,
  onToggleForm,
  onTagLibraryChanged,
  onUnmatch,
  tagLibrary,
  transactions,
  transactionForm,
}: {
  accountKey: SnapshotAccountKey;
  accountLabel: string;
  categories: ExpenseCategory[];
  confirmingDeleteId: number | null;
  deletingId: number | null;
  error: string;
  formError: string;
  formOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  manualPendingTransactions: PendingTransaction[];
  onChangeTransactionForm: (
    update: Partial<{
      note: string;
      amount: string;
      direction: "debit" | "credit";
      account: SnapshotAccountKey;
      expected_post_date: string;
    }>,
  ) => void;
  onDeleteTransaction: (transaction: PendingTransaction) => void;
  onMarkCleared: (transaction: PendingTransaction) => void;
  onReconcile: (
    transaction: PendingTransaction,
    action: "confirm" | "reject" | "undo",
  ) => void;
  onSubmitPendingTransaction: (event: FormEvent<HTMLFormElement>) => void;
  onTransactionUpdated: (transaction: CreditCardTransaction) => void;
  onToggleForm: (accountKey: SnapshotAccountKey) => void;
  onTagLibraryChanged: (tags: ExpenseTag[]) => void;
  onUnmatch: (pendingTransactionId: number) => void;
  tagLibrary: ExpenseTag[];
  transactions: CreditCardTransaction[];
  transactionForm: {
    note: string;
    amount: string;
    direction: "debit" | "credit";
    account: SnapshotAccountKey;
    expected_post_date: string;
  };
}) {
  const transactionCategoryLabels = categoryLabelMap(categories);
  const transactionCategoryOptions = sortedCategoryOptions(categories);
  const linkedPendingIds = new Set(
    manualPendingTransactions
      .filter((transaction) => transaction.match_status === "matched_pending")
      .map((transaction) => transaction.matched_transaction),
  );
  const pending = transactions.filter(
    (transaction) => transaction.pending && !linkedPendingIds.has(transaction.id),
  );
  const posted = transactions.filter((transaction) => !transaction.pending);
  const pendingCount = pending.length + manualPendingTransactions.length;
  const [confirmingMatchId, setConfirmingMatchId] = useState<number | null>(null);
  const [confirmingUnmatchId, setConfirmingUnmatchId] = useState<number | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [savingTransactionId, setSavingTransactionId] = useState<number | null>(null);
  const [autoCategorizingTransactionId, setAutoCategorizingTransactionId] = useState<number | null>(null);
  const [savingBudgetFlagsId, setSavingBudgetFlagsId] = useState<number | null>(null);
  const [budgetFlagsError, setBudgetFlagsError] = useState("");
  const [relationshipQuery, setRelationshipQuery] = useState("");
  const [relationshipResults, setRelationshipResults] = useState<CreditCardTransaction[]>([]);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipSavingId, setRelationshipSavingId] = useState<number | null>(null);
  const [relationshipError, setRelationshipError] = useState("");
  const [relationshipSuggestions, setRelationshipSuggestions] = useState<SuggestedRelatedTransaction[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    match_type: "exact" as "exact" | "starts_with",
    match_value: "",
    category: "dining",
    tags: [] as string[],
    note: "",
  });
  const [newTagName, setNewTagName] = useState("");
  const [newTagFormOpen, setNewTagFormOpen] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [relatedExpanded, setRelatedExpanded] = useState(false);
  const [categorizationExpanded, setCategorizationExpanded] = useState(false);
  const [budgetTreatmentExpanded, setBudgetTreatmentExpanded] = useState(false);

  useEffect(() => {
    if (confirmingMatchId === null) return;

    function cancelMatchConfirmation(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          `[data-match-confirmation="${confirmingMatchId}"]`,
        )
      ) {
        return;
      }
      setConfirmingMatchId(null);
    }

    document.addEventListener("pointerdown", cancelMatchConfirmation);
    return () => {
      document.removeEventListener("pointerdown", cancelMatchConfirmation);
    };
  }, [confirmingMatchId]);

  function openTransactionEditor(transaction: CreditCardTransaction) {
    setEditingTransactionId(transaction.id);
    setEditError("");
    setEditForm({
      match_type: "exact",
      match_value: transaction.description,
      category:
        transaction.category && transaction.category !== "needs_review"
          ? transaction.category
          : "dining",
      tags: (transaction.tags || []).map((tag) => tag.name),
      note: transaction.note || "",
    });
    setNewTagName("");
    setNewTagFormOpen(false);
    setTagsExpanded(false);
    setNoteExpanded(false);
    setRelatedExpanded(false);
    setCategorizationExpanded(false);
    setBudgetTreatmentExpanded(false);
    setRelationshipQuery("");
    setRelationshipResults([]);
    setRelationshipError("");
    void loadRelationshipSuggestions(transaction.id);
  }

  function toggleTransactionEditor(transaction: CreditCardTransaction) {
    if (editingTransactionId === transaction.id) {
      setEditingTransactionId(null);
      return;
    }
    openTransactionEditor(transaction);
  }

  async function loadRelationshipSuggestions(transactionId: number) {
    setSuggestionsLoading(true);
    setRelationshipError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transactionId}/relationship-suggestions`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => null)) as SuggestedRelatedTransaction[] | { message?: string } | null;
      if (!response.ok || !Array.isArray(data)) {
        throw new Error(data && !Array.isArray(data) ? data.message : "Unable to load suggestions.");
      }
      setRelationshipSuggestions(data);
    } catch (error) {
      setRelationshipError(error instanceof Error ? error.message : "Unable to load suggestions.");
      setRelationshipSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function dismissRelationshipSuggestion(transactionId: number, relatedTransactionId: number) {
    setRelationshipSavingId(relatedTransactionId);
    setRelationshipError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transactionId}/relationship-suggestions`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ related_transaction_id: relatedTransactionId }),
        },
      );
      if (!response.ok) throw new Error("Unable to dismiss this suggestion.");
      setRelationshipSuggestions((current) => current.filter((item) => item.id !== relatedTransactionId));
    } catch (error) {
      setRelationshipError(error instanceof Error ? error.message : "Unable to dismiss this suggestion.");
    } finally {
      setRelationshipSavingId(null);
    }
  }

  async function searchRelatedTransactions(transactionId: number) {
    const query = relationshipQuery.trim();
    if (!query) return;
    setRelationshipLoading(true);
    setRelationshipError("");
    try {
      const params = new URLSearchParams({
        include_unbudgeted: "true",
        search: query,
        exclude_id: String(transactionId),
        limit: "10",
      });
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => null)) as CreditCardTransaction[] | { message?: string } | null;
      if (!response.ok || !Array.isArray(data)) {
        throw new Error(data && !Array.isArray(data) ? data.message : "Unable to search transactions.");
      }
      setRelationshipResults(data);
    } catch (error) {
      setRelationshipError(error instanceof Error ? error.message : "Unable to search transactions.");
    } finally {
      setRelationshipLoading(false);
    }
  }

  async function updateRelationship(transactionId: number, relatedTransactionId: number, method: "POST" | "DELETE") {
    setRelationshipSavingId(relatedTransactionId);
    setRelationshipError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transactionId}/relationships`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ related_transaction_id: relatedTransactionId }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { message?: string; detail?: string } | null;
        throw new Error(data?.message || data?.detail || "Unable to update this relationship.");
      }
      const updated = (await response.json()) as CreditCardTransaction;
      setRelationshipResults((current) => current.filter((item) => item.id !== relatedTransactionId));
      setRelationshipSuggestions((current) => current.filter((item) => item.id !== relatedTransactionId));
      onTransactionUpdated(updated);
    } catch (error) {
      setRelationshipError(error instanceof Error ? error.message : "Unable to update this relationship.");
    } finally {
      setRelationshipSavingId(null);
    }
  }

  async function updateTransactionBudgetFlags(
    transaction: CreditCardTransaction,
    patch: Partial<Pick<CreditCardTransaction, "split" | "include">>,
  ) {
    setSavingBudgetFlagsId(transaction.id);
    setBudgetFlagsError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/update-budget-flags?include_unbudgeted=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const updated = (await response.json().catch(() => null)) as
        | CreditCardTransaction
        | { message?: string; detail?: string }
        | null;
      if (!response.ok || !updated || !("id" in updated)) {
        throw new Error(
          updated && !("id" in updated)
            ? updated.message || updated.detail || "Unable to update this transaction."
            : "Unable to update this transaction.",
        );
      }
      onTransactionUpdated(updated);
    } catch (error) {
      setBudgetFlagsError(
        error instanceof Error ? error.message : "Unable to update this transaction.",
      );
    } finally {
      setSavingBudgetFlagsId(null);
    }
  }

  async function saveTransactionEditor(transaction: CreditCardTransaction, applyToMatching = false) {
    setSavingTransactionId(transaction.id);
    setEditError("");
    try {
      const categoryResponse = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/correct-category?include_unbudgeted=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match_type: editForm.match_type,
            match_value: editForm.match_value,
            category: editForm.category,
            apply_to_matching: applyToMatching,
          }),
        },
      );
      if (!categoryResponse.ok) {
        throw new Error("Unable to update the transaction category.");
      }
      const tagResponse = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/update-tags?include_unbudgeted=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: editForm.tags }),
        },
      );
      if (!tagResponse.ok) {
        throw new Error("The category was saved, but the tags could not be updated.");
      }
      const taggedTransaction = (await tagResponse.json()) as CreditCardTransaction;
      onTagLibraryChanged(taggedTransaction.tags || []);
      const noteResponse = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/update-note?include_unbudgeted=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: editForm.note }),
        },
      );
      if (!noteResponse.ok) {
        throw new Error("The category and tags were saved, but the note could not be updated.");
      }
      const updated = (await noteResponse.json()) as CreditCardTransaction;
      setEditingTransactionId(null);
      onTransactionUpdated(updated);
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Unable to update the transaction.",
      );
    } finally {
      setSavingTransactionId(null);
    }
  }

  async function autoCategorizeTransaction(transaction: CreditCardTransaction) {
    setAutoCategorizingTransactionId(transaction.id);
    setEditError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/auto-categorize?include_unbudgeted=true`,
        { method: "POST" },
      );
      const updated = (await response.json().catch(() => null)) as
        | CreditCardTransaction
        | { message?: string; detail?: string }
        | null;
      if (!response.ok || !updated || !("id" in updated)) {
        throw new Error(
          updated && !("id" in updated)
            ? updated.message || updated.detail || "Unable to auto categorize this transaction."
            : "Unable to auto categorize this transaction.",
        );
      }
      setEditForm((current) => ({ ...current, category: updated.category }));
      onTransactionUpdated(updated);
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Unable to auto categorize this transaction.",
      );
    } finally {
      setAutoCategorizingTransactionId(null);
    }
  }

  function toggleEditorTag(name: string, enabled: boolean) {
    const cleaned = name.trim();
    if (!cleaned) return;
    setEditForm((current) => ({
      ...current,
      tags: enabled
        ? current.tags.some((tag) => tag.toLowerCase() === cleaned.toLowerCase())
          ? current.tags
          : [...current.tags, cleaned]
        : current.tags.filter((tag) => tag.toLowerCase() !== cleaned.toLowerCase()),
    }));
    setNewTagName("");
    setNewTagFormOpen(false);
  }

  function transactionRows(
    items: CreditCardTransaction[],
    emptyLabel = "No transactions found.",
  ) {
    if (!items.length) {
      return (
        <p className="rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-muted">
          {emptyLabel}
        </p>
      );
    }

    return (
      <div className="overflow-hidden rounded-xl border border-white/10">
        {budgetFlagsError ? (
          <p className="border-b border-rose-300/15 bg-rose-300/10 px-3 py-2 text-xs text-rose-200" role="alert">
            {budgetFlagsError}
          </p>
        ) : null}
        {items.map((transaction) => {
          const isCredit =
            transaction.transaction_type === "payment" ||
            transaction.transaction_type === "credit";
          const hasReceiptLineItems = Boolean(
            transaction.amazon_orders?.some((order) => order.items.length) ||
            transaction.receipt_orders?.some((order) => order.items.length),
          );
          return (
            <div
              className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-white/[0.07] px-4 py-3 transition-colors duration-[250ms] ease-out last:border-b-0 ${editingTransactionId === transaction.id ? "bg-sky-400/[0.12]" : "hover:bg-white/[0.025]"}`}
              key={transaction.id}
              onClick={(event) => {
                const target = event.target;
                if (target instanceof Element && target.closest("a, button, input, label, select, textarea, [data-transaction-editor]")) return;
                toggleTransactionEditor(transaction);
              }}
            >
              <div className="contents">
                <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {transaction.description}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatTransactionDate(transaction.posting_date || transaction.transaction_date)} · {transaction.issuer} •••• {transaction.account_last_four}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                  {transactionCategoryLabels[transaction.category] ||
                    (transaction.category === "needs_review"
                      ? "Needs review"
                      : transaction.category || transaction.transaction_type)}
                </p>
                {transaction.tags?.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {transaction.tags.map((tag) => (
                      <span
                        className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2 py-0.5 text-[10px] text-sky-100"
                        key={tag.id}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                ) : null}
                {transaction.note ? (
                  <p className="mt-1.5 text-xs italic text-white/55">
                    {transaction.note}
                  </p>
                ) : null}
                {transaction.related_transactions?.length ? (
                  <div className="mt-2 space-y-1.5">
                    {transaction.related_transactions.map((related) => (
                      <div className="rounded-lg border border-gold/15 bg-gold/[0.05] px-2.5 py-2 text-xs" key={related.id}>
                        <p className="font-medium text-gold">Related to: {related.description}</p>
                        <p className="mt-1 text-muted">
                          {formatTransactionDate(related.transaction_date)} · {related.issuer} •••• {related.account_last_four} · {formatCurrency(related.amount)}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                          {transactionCategoryLabels[related.category] || related.category || related.transaction_type}
                          {related.tags?.length ? ` · ${related.tags.map((tag) => tag.name).join(", ")}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {transaction.manual_match ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-accent">
                    <span>Matched from manual entry “{transaction.manual_match.note}”</span>
                    <button
                      className="rounded-md border border-white/10 px-2 py-1 text-white/65 hover:border-white/20 hover:text-white"
                      onClick={() => {
                        if (confirmingUnmatchId === transaction.id) {
                          onUnmatch(transaction.manual_match!.pending_transaction_id);
                          setConfirmingUnmatchId(null);
                        } else {
                          setConfirmingUnmatchId(transaction.id);
                        }
                      }}
                      type="button"
                    >
                      {confirmingUnmatchId === transaction.id ? "Confirm" : "Unmatch"}
                    </button>
                  </div>
                ) : null}
                </div>
                <div className="col-span-2 min-w-0">
                  <AmazonOrderDetails orders={transaction.amazon_orders || []} />
                </div>
                <div className="col-span-2 min-w-0">
                  <ReceiptOrderDetails orders={transaction.receipt_orders || []} />
                </div>
                {editingTransactionId === transaction.id ? (
                  <div className="col-span-2 mt-3 cursor-default" data-transaction-editor>
                  <div className="rounded-xl border border-white/[0.08] bg-black/10 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        aria-controls={`transaction-${transaction.id}-tags`}
                        aria-expanded={tagsExpanded}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${tagsExpanded ? "border-sky-300/30 bg-sky-400/10 text-sky-100" : "border-white/10 text-white/65 hover:border-sky-300/25 hover:text-sky-100"}`}
                        onClick={() => {
                          if (tagsExpanded) setNewTagFormOpen(false);
                          setTagsExpanded(!tagsExpanded);
                        }}
                        type="button"
                      >
                        Tags
                      </button>
                      <button
                        aria-controls={`transaction-${transaction.id}-note`}
                        aria-expanded={noteExpanded}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${noteExpanded ? "border-accent/30 bg-accent/10 text-accent" : "border-white/10 text-white/65 hover:border-accent/25 hover:text-accent"}`}
                        onClick={() => setNoteExpanded((current) => !current)}
                        type="button"
                      >
                        Note
                      </button>
                      <button
                        aria-controls={`transaction-${transaction.id}-related`}
                        aria-expanded={relatedExpanded}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${relatedExpanded ? "border-gold/30 bg-gold/10 text-gold" : "border-white/10 text-white/65 hover:border-gold/25 hover:text-gold"}`}
                        onClick={() => setRelatedExpanded((current) => !current)}
                        type="button"
                      >
                        Related transactions
                      </button>
                      <button
                        aria-controls={`transaction-${transaction.id}-categorization`}
                        aria-expanded={categorizationExpanded}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${categorizationExpanded ? "border-violet-300/30 bg-violet-400/10 text-violet-100" : "border-white/10 text-white/65 hover:border-violet-300/25 hover:text-violet-100"}`}
                        onClick={() => setCategorizationExpanded((current) => !current)}
                        type="button"
                      >
                        Categorize
                      </button>
                      {hasReceiptLineItems ? (
                        <button
                          className="rounded-lg border border-violet-300/30 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:border-violet-300/50 hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={autoCategorizingTransactionId === transaction.id}
                          onClick={() => void autoCategorizeTransaction(transaction)}
                          title="Uses the matched receipt line items to choose one category."
                          type="button"
                        >
                          {autoCategorizingTransactionId === transaction.id
                            ? "Auto categorizing…"
                            : "Auto categorize"}
                        </button>
                      ) : null}
                      <button
                        aria-controls={`transaction-${transaction.id}-budget-treatment`}
                        aria-expanded={budgetTreatmentExpanded}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${budgetTreatmentExpanded ? "border-accent/30 bg-accent/10 text-accent" : "border-white/10 text-white/65 hover:border-accent/25 hover:text-accent"}`}
                        onClick={() => setBudgetTreatmentExpanded((current) => !current)}
                        type="button"
                      >
                        Budget treatment
                      </button>
                    </div>
                    {tagsExpanded ? (
                      <div className="mt-3 border-t border-white/[0.07] pt-3" id={`transaction-${transaction.id}-tags`}>
                        <div className="flex flex-wrap gap-2">
                          {editForm.tags.map((tag) => (
                            <button
                              className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2.5 py-1 text-[11px] text-sky-100"
                              key={tag}
                              onClick={() => toggleEditorTag(tag, false)}
                              type="button"
                            >
                              {tag} ×
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Available tags</span>
                          <button
                            aria-label="Create a new tag"
                            className="grid size-6 place-items-center rounded-full border border-white/10 text-sm text-white/60 hover:border-sky-300/30 hover:text-sky-100"
                            onClick={() => setNewTagFormOpen((current) => !current)}
                            type="button"
                          >
                            <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 16 16">
                              <path d="M8 3.25v9.5M3.25 8h9.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
                            </svg>
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {tagLibrary
                            .filter((tag) => !editForm.tags.some((selected) => selected.toLowerCase() === tag.name.toLowerCase()))
                            .map((tag) => (
                              <button
                                className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/60 hover:border-sky-300/20 hover:text-sky-100"
                                key={tag.id}
                                onClick={() => toggleEditorTag(tag.name, true)}
                                type="button"
                              >
                                + {tag.name}
                              </button>
                            ))}
                        </div>
                        {newTagFormOpen ? (
                          <div className="mt-3 flex gap-2">
                            <input
                              className="h-9 min-w-48 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50"
                              maxLength={40}
                              onChange={(event) => setNewTagName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  toggleEditorTag(newTagName, true);
                                }
                              }}
                              placeholder="Create a tag"
                              value={newTagName}
                            />
                            <button className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70" onClick={() => toggleEditorTag(newTagName, true)} type="button">Add</button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {noteExpanded ? (
                      <label className="mt-3 block border-t border-white/[0.07] pt-3" id={`transaction-${transaction.id}-note`}>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Transaction note</span>
                        <textarea
                          className="mt-2 min-h-20 w-full resize-y rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-xs text-white outline-none focus:border-accent/50"
                          maxLength={2000}
                          onChange={(event) => setEditForm((current) => ({ ...current, note: event.target.value }))}
                          placeholder="Add context about this transaction"
                          value={editForm.note}
                        />
                      </label>
                    ) : null}
                    {budgetTreatmentExpanded ? <div className="mt-3 border-t border-white/[0.07] pt-3" id={`transaction-${transaction.id}-budget-treatment`}>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Budget treatment</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          aria-pressed={transaction.split}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition disabled:opacity-50 ${transaction.split ? "border-violet-300/30 bg-violet-400/15 text-violet-100" : "border-white/10 text-white/45 hover:text-white/70"}`}
                          disabled={savingBudgetFlagsId === transaction.id}
                          onClick={() => void updateTransactionBudgetFlags(transaction, { split: !transaction.split })}
                          type="button"
                        >Split</button>
                        <button
                          aria-pressed={transaction.include}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition disabled:opacity-50 ${transaction.include ? "border-accent/25 bg-accent/10 text-accent" : "border-rose-300/20 bg-rose-400/10 text-rose-100"}`}
                          disabled={savingBudgetFlagsId === transaction.id}
                          onClick={() => void updateTransactionBudgetFlags(transaction, { include: !transaction.include })}
                          type="button"
                        >{transaction.include ? "Included" : "Excluded"}</button>
                      </div>
                    </div> : null}
                    {relatedExpanded ? <div className="mt-4 border-t border-white/[0.07] pt-3" id={`transaction-${transaction.id}-related`}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Related transactions</p>
                      {suggestionsLoading ? <p className="mt-2 text-xs text-muted">Finding likely matches…</p> : null}
                      {relationshipSuggestions.length ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-[11px] font-medium text-gold">Suggested matches</p>
                          {relationshipSuggestions.map((suggestion) => (
                            <div className="rounded-lg border border-gold/20 bg-gold/[0.05] px-3 py-2" key={suggestion.id}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-white">{suggestion.description}</p>
                                  <p className="mt-0.5 text-[11px] text-muted">{formatTransactionDate(suggestion.transaction_date)} · {suggestion.issuer} •••• {suggestion.account_last_four} · {formatCurrency(suggestion.amount)}</p>
                                  <p className="mt-1 text-[11px] text-gold">{suggestion.match_reason}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent disabled:opacity-50" disabled={relationshipSavingId === suggestion.id} onClick={() => void updateRelationship(transaction.id, suggestion.id, "POST")} type="button">Link</button>
                                  <button className="px-2 py-1.5 text-xs text-muted hover:text-white disabled:opacity-50" disabled={relationshipSavingId === suggestion.id} onClick={() => void dismissRelationshipSuggestion(transaction.id, suggestion.id)} type="button">Dismiss</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {transaction.related_transactions?.length ? (
                        <div className="mt-2 space-y-2">
                          {transaction.related_transactions.map((related) => (
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] px-3 py-2" key={related.id}>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-white">{related.description}</p>
                                <p className="mt-0.5 text-[11px] text-muted">{formatTransactionDate(related.transaction_date)} · {related.issuer} •••• {related.account_last_four} · {formatCurrency(related.amount)}</p>
                              </div>
                              <button className="text-xs text-rose-200 disabled:opacity-50" disabled={relationshipSavingId === related.id} onClick={() => void updateRelationship(transaction.id, related.id, "DELETE")} type="button">Unlink</button>
                            </div>
                          ))}
                        </div>
                      ) : <p className="mt-2 text-xs text-muted">No related transactions yet.</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          className="h-9 min-w-64 flex-1 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50"
                          onChange={(event) => setRelationshipQuery(event.target.value)}
                          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchRelatedTransactions(transaction.id); } }}
                          placeholder="Search merchant, amount, account, or YYYY-MM-DD"
                          value={relationshipQuery}
                        />
                        <button className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 disabled:opacity-50" disabled={relationshipLoading || !relationshipQuery.trim()} onClick={() => void searchRelatedTransactions(transaction.id)} type="button">{relationshipLoading ? "Searching…" : "Search"}</button>
                      </div>
                      {relationshipResults.length ? (
                        <div className="mt-2 space-y-2">
                          {relationshipResults.map((result) => (
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/10 bg-accent/[0.03] px-3 py-2" key={result.id}>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-white">{result.description}</p>
                                <p className="mt-0.5 text-[11px] text-muted">{formatTransactionDate(result.transaction_date)} · {result.issuer} •••• {result.account_last_four} · {formatCurrency(result.amount)}</p>
                              </div>
                              <button className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent disabled:opacity-50" disabled={relationshipSavingId === result.id} onClick={() => void updateRelationship(transaction.id, result.id, "POST")} type="button">Link</button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {relationshipError ? <p className="mt-2 text-xs text-rose-200">{relationshipError}</p> : null}
                    </div> : null}
                  </div>
                  {categorizationExpanded ? <div className="mt-3 grid items-center gap-2 sm:grid-cols-[auto_minmax(12rem,1fr)_auto_minmax(10rem,auto)]" id={`transaction-${transaction.id}-categorization`}>
                    <select
                      aria-label="Match condition"
                      className="h-9 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50"
                      onChange={(event) => setEditForm((current) => ({ ...current, match_type: event.target.value as "exact" | "starts_with" }))}
                      value={editForm.match_type}
                    >
                      <option value="exact">Equals</option>
                      <option value="starts_with">Starts with</option>
                    </select>
                    <input
                      aria-label="Match value"
                      className="h-9 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50"
                      onChange={(event) => setEditForm((current) => ({ ...current, match_value: event.target.value }))}
                      value={editForm.match_value}
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Set category</span>
                    <select
                      aria-label={`Correct category for ${transaction.description}`}
                      className="h-9 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50"
                      onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))}
                      value={editForm.category}
                    >
                      {transactionCategoryOptions.map((category) => (
                        <option key={category.key} value={category.key}>{category.label}</option>
                      ))}
                    </select>
                  </div> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50"
                        disabled={savingTransactionId === transaction.id}
                        onClick={() => void saveTransactionEditor(transaction)}
                        type="button"
                      >
                        {savingTransactionId === transaction.id ? "Saving…" : "Save this transaction"}
                      </button>
                      <button
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-muted hover:border-accent/25 hover:text-accent disabled:opacity-50"
                        disabled={savingTransactionId === transaction.id}
                        onClick={() => void saveTransactionEditor(transaction, true)}
                        type="button"
                      >Save &amp; remember</button>
                      <button className="px-2 py-2 text-xs text-muted hover:text-white" onClick={() => setEditingTransactionId(null)} type="button">Cancel</button>
                  </div>
                  <p className="mt-2 text-[11px] text-muted">Save this transaction changes only the selected row. Save &amp; remember also updates matching descriptions and future imports.</p>
                  {editError ? <p className="mt-2 text-xs text-rose-200">{editError}</p> : null}
                  </div>
                ) : null}
              </div>
              <div className="col-start-2 row-start-1 flex items-center gap-3 self-start">
                <span className={`whitespace-nowrap text-right font-mono text-sm ${isCredit ? "text-accent" : "text-white"}`}>
                  {signedTransactionAmount(transaction, accountKey)}
                </span>
                <button
                  aria-expanded={editingTransactionId === transaction.id}
                  aria-label={`${editingTransactionId === transaction.id ? "Collapse" : "Expand"} transaction ${transaction.description}`}
                  className="grid size-7 place-items-center rounded-full border border-white/10 text-base font-medium text-white/55 transition hover:border-accent/25 hover:text-accent"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleTransactionEditor(transaction);
                  }}
                  type="button"
                >
                  <span aria-hidden="true">{editingTransactionId === transaction.id ? "−" : "+"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function manualPendingRows(items: PendingTransaction[]) {
    if (!items.length) return null;

    return (
      <div className="mb-3 overflow-hidden rounded-xl border border-amber-100/15 bg-amber-200/[0.04]">
        {items.map((transaction) => (
          <div
            className={`grid gap-3 border-b border-white/[0.07] px-3 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_11rem] sm:items-center ${
              transaction.is_cleared ? "opacity-45" : ""
            }`}
            key={transaction.id}
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-white/80">
                {transaction.note}
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-muted">
                {transaction.match_status === "matched_pending"
                  ? `Matched to synced transaction from ${formatTransactionDate(transaction.matched_transaction_detail?.transaction_date || transaction.expected_post_date)}`
                  : transaction.match_status === "suggested"
                    ? `Possible match from ${formatTransactionDate(transaction.matched_transaction_detail?.transaction_date || transaction.expected_post_date)}`
                    : `Manual pending · ${Number(transaction.amount) < 0 ? "Credit" : "Debit"} · Expected ${compactDateFormatter.format(new Date(`${transaction.expected_post_date}T12:00:00`))}`}
              </p>
            </div>
            <span className="whitespace-nowrap text-right font-mono text-sm text-amber-100">
              {formatCurrency(
                manualPendingTransactionDisplayAmount(
                  transaction.amount,
                  transaction.account,
                ) ?? undefined,
              )}
            </span>
            <div className="flex flex-wrap items-center justify-start gap-2 sm:flex-nowrap sm:justify-end">
              {transaction.match_status === "suggested" ? (
                <>
                  <button
                    className="inline-flex h-10 w-20 items-center justify-center whitespace-nowrap rounded-lg border border-accent/25 bg-accent/10 px-3 text-xs font-medium text-accent transition hover:bg-accent/15"
                    onClick={() => onReconcile(transaction, "confirm")}
                    type="button"
                  >
                    Match
                  </button>
                  <button
                    className="inline-flex h-10 min-w-20 items-center justify-center whitespace-nowrap rounded-lg border border-white/10 px-3 text-xs font-medium text-white/65 transition hover:border-white/20 hover:text-white"
                    onClick={() => onReconcile(transaction, "reject")}
                    type="button"
                  >
                    Not match
                  </button>
                </>
              ) : transaction.match_status === "matched_pending" ? (
                <>
                  <button
                    data-match-confirmation={transaction.id}
                    className={`inline-flex h-8 w-24 items-center justify-center gap-1.5 rounded-full border px-2 text-[11px] font-semibold transition ${
                      confirmingMatchId === transaction.id
                        ? "border-amber-200/30 bg-amber-200/10 text-amber-100"
                        : "border-accent/25 bg-accent/[0.07] text-accent hover:border-accent/40 hover:bg-accent/10"
                    }`}
                    onClick={() => {
                      if (confirmingMatchId === transaction.id) {
                        onReconcile(transaction, "confirm");
                        setConfirmingMatchId(null);
                      } else {
                        setConfirmingMatchId(transaction.id);
                      }
                    }}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className={`size-1.5 rounded-full ${
                        confirmingMatchId === transaction.id
                          ? "bg-amber-200"
                          : "bg-accent"
                      }`}
                    />
                    {confirmingMatchId === transaction.id ? "Confirm" : "Matched"}
                  </button>
                </>
              ) : transaction.is_cleared ? (
                <span className="w-20 text-center text-xs font-medium text-accent">
                  Cleared
                </span>
              ) : (
                <button
                  className="w-20 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/70 transition hover:border-accent/30 hover:text-accent"
                  onClick={() => onMarkCleared(transaction)}
                  type="button"
                >
                  Clear
                </button>
              )}
              {transaction.match_status !== "suggested" && transaction.match_status !== "matched_pending" ? <button
                className={`w-20 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
                  confirmingDeleteId === transaction.id
                    ? "border-rose-300/35 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                    : "border-rose-300/15 text-rose-200/80 hover:border-rose-300/35 hover:bg-rose-500/10 hover:text-rose-100"
                }`}
                disabled={deletingId === transaction.id}
                onClick={() => onDeleteTransaction(transaction)}
                type="button"
              >
                {deletingId === transaction.id
                  ? "Deleting…"
                  : confirmingDeleteId === transaction.id
                    ? "Confirm"
                    : "Delete"}
              </button> : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function pendingForm() {
    if (!formOpen) return null;

    return (
      <form
        className="mb-3 grid gap-3 rounded-xl border border-accent/20 bg-accent/[0.04] p-3 sm:grid-cols-2"
        onSubmit={onSubmitPendingTransaction}
      >
        <label className="sm:col-span-2">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Note
          </span>
          <input
            className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-accent/50"
            maxLength={255}
            onChange={(event) =>
              onChangeTransactionForm({ note: event.target.value })
            }
            placeholder={`What is pending on ${accountLabel}?`}
            required
            value={transactionForm.note}
          />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Transaction type
          </legend>
          <div className="inline-grid h-11 grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1">
            {(["debit", "credit"] as const).map((direction) => (
              <label className="cursor-pointer" key={direction}>
                <input
                  checked={transactionForm.direction === direction}
                  className="peer sr-only"
                  name="pending-transaction-direction"
                  onChange={() => onChangeTransactionForm({ direction })}
                  type="radio"
                  value={direction}
                />
                <span
                  className={`grid h-full min-w-24 place-items-center rounded-lg px-5 text-sm font-semibold transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60 ${
                    transactionForm.direction === direction
                      ? "bg-accent/15 text-accent shadow-sm"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {direction === "debit" ? "Debit" : "Credit"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Amount
          </span>
          <input
            className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 font-mono text-sm text-white outline-none focus:border-accent/50"
            min="0.01"
            onChange={(event) =>
              onChangeTransactionForm({ amount: event.target.value })
            }
            placeholder="0.00"
            required
            step="0.01"
            type="number"
            value={transactionForm.amount}
          />
        </label>
        <label>
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Expected post date
          </span>
          <input
            className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-accent/50"
            onChange={(event) =>
              onChangeTransactionForm({
                expected_post_date: event.target.value,
              })
            }
            required
            type="date"
            value={transactionForm.expected_post_date}
          />
        </label>
        <div className="flex items-end gap-2 sm:col-span-2">
          <button
            className="h-11 rounded-xl border border-accent/25 bg-accent/10 px-4 text-sm font-semibold text-accent transition hover:bg-accent/15 disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving…" : "Save pending transaction"}
          </button>
          <button
            className="h-11 rounded-xl border border-white/10 px-4 text-sm font-semibold text-white/60 transition hover:border-white/20 hover:text-white"
            onClick={() => onToggleForm(accountKey)}
            type="button"
          >
            Cancel
          </button>
        </div>
        {formError ? (
          <p
            className="sm:col-span-2 rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
            role="alert"
          >
            {formError}
          </p>
        ) : null}
      </form>
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
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
                  Pending
                </p>
                <span className="text-xs text-muted">{pendingCount}</span>
              </div>
              <button
                className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/15"
                onClick={() => onToggleForm(accountKey)}
                type="button"
              >
                {formOpen ? "Cancel" : "Add pending"}
              </button>
            </div>
            {pendingForm()}
            {manualPendingRows(manualPendingTransactions)}
            {transactionRows(pending, "No Pending Transactions")}
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
  initialCreditCardTransactions = [],
  initialFinancialGoals = [],
  initialFinancialReminders = [],
  initialGoalTransactions = [],
  initialIncomeEntries = [],
  initialPendingCardTransactions = [],
  initialExpenseCategories = [],
  initialExpenseTags = [],
  initialPendingTransactions,
  view = "overview",
}: {
  initialBudgetPlanSettings?: BudgetPlanSettings;
  initialCreditCardTransactions?: CreditCardTransaction[];
  initialFinancialGoals?: FinancialGoal[];
  initialFinancialReminders?: FinancialReminder[];
  initialGoalTransactions?: TransactionSelectorRecord[];
  initialIncomeEntries?: IncomeEntry[];
  initialPendingCardTransactions?: PendingCardTransaction[];
  initialExpenseCategories?: ExpenseCategory[];
  initialExpenseTags?: ExpenseTag[];
  initialPendingTransactions?: PendingTransaction[];
  view?: FinancialView;
}) {
  const budgetData = useOptionalBudgetData();
  const { snapshot } = useLiveSnapshot();
  const creditCardTransactions =
    budgetData?.creditCardTransactions ?? initialCreditCardTransactions;
  const goalTransactions =
    budgetData?.creditCardTransactions ?? initialGoalTransactions;
  const expenseCategories = budgetData?.expenseCategories ?? initialExpenseCategories;
  const incomeEntries = budgetData?.incomeEntries ?? initialIncomeEntries;
  const [localPendingTransactions, setLocalPendingTransactions] = useState(
    initialPendingTransactions ?? [],
  );
  const pendingTransactions =
    budgetData?.pendingTransactions ?? localPendingTransactions;
  const setPendingTransactions =
    budgetData?.setPendingTransactions ?? setLocalPendingTransactions;
  const budgetPlanSettings =
    budgetData?.budgetPlanSettings ?? initialBudgetPlanSettings;
  const accounts = useMemo(
    () => accountLinkAccounts.map((account) => ({
      ...account,
      label: accountDisplayName(account.key, budgetPlanSettings?.account_display_names),
    })),
    [budgetPlanSettings?.account_display_names],
  );
  const [expenseTags, setExpenseTags] = useState(initialExpenseTags);

  useEffect(() => {
    setLocalPendingTransactions(initialPendingTransactions ?? []);
  }, [initialPendingTransactions]);

  function mergeExpenseTags(tags: ExpenseTag[]) {
    setExpenseTags((current) => {
      const byName = new Map(current.map((tag) => [tag.name.toLowerCase(), tag]));
      tags.forEach((tag) => byName.set(tag.name.toLowerCase(), tag));
      return Array.from(byName.values()).sort((left, right) =>
        left.name.localeCompare(right.name),
      );
    });
  }

  if (!budgetPlanSettings) {
    throw new Error(
      "LiveBankValues requires budget plan settings from props or BudgetDataProvider.",
    );
  }
  const [formOpenAccount, setFormOpenAccount] =
    useState<SnapshotAccountKey | null>(null);
  const [formError, setFormError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [payingAccount, setPayingAccount] =
    useState<SnapshotAccountKey | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedAccount, setExpandedAccount] =
    useState<SnapshotAccountKey | null>(null);
  const [accountTransactions, setAccountTransactions] =
    useState<AccountTransactionState>(() =>
      initialAccountTransactionState(creditCardTransactions),
    );
  const [transactionForm, setTransactionForm] = useState({
    note: "",
    amount: "",
    direction: "debit" as "debit" | "credit",
    account: "chase_checking" as SnapshotAccountKey,
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
    useState<SnapshotAccountKey | null>(null);
  const payCycle = getNextPayCycle(
    currentDate,
    budgetPlanSettings.next_payday_override,
  );
  const nextPaydayTimestamp = payCycle.nextPayday.getTime();
  const projectedNextPaycheck = useMemo(() => {
    const projection = classifyPaychecks(
      incomeEntries,
      currentDate,
      new Date(nextPaydayTimestamp),
    );
    return projection.normalPaychecks.length
      ? projection.predictedNetPay
      : null;
  }, [currentDate, incomeEntries, nextPaydayTimestamp]);

  useEffect(() => {
    const refreshDate = window.setInterval(
      () => setCurrentDate(new Date()),
      60 * 1000,
    );

    return () => window.clearInterval(refreshDate);
  }, []);

  const calculations = useMemo(() => {
    const {
      adjustedValue,
      liabilityPendingByAccount,
      pendingByAccount,
      settledAccounts,
    } = calculateAdjustedAccountBalances({
      snapshot,
      pendingTransactions,
      pendingCardTransactions: initialPendingCardTransactions,
      loadedCardTransactions:
        view === "overview" ? undefined : accountTransactions,
    });

    const chaseChecking = adjustedValue("chase_checking");
    const chaseSavings = adjustedValue("chase_savings");
    const savingsReserve = getSavingsReservePosition(chaseSavings);
    const creditCardBalance =
      adjustedValue("chase_credit") +
      adjustedValue("chase_credit_8506") +
      adjustedValue("citi_current") +
      adjustedValue("citi_pending") +
      adjustedValue("barclays_card");
    const cashPendingLiabilities =
      (pendingByAccount.get("chase_checking") || 0) +
      (pendingByAccount.get("chase_savings") || 0);
    const liabilities = creditCardBalance + cashPendingLiabilities;
    const nonRetirementCash =
      valueFromSnapshot(snapshot, "chase_checking") +
      valueFromSnapshot(snapshot, "chase_savings") +
      valueFromSnapshot(snapshot, "etrade") +
      valueFromSnapshot(snapshot, "betterment_general") +
      valueFromSnapshot(snapshot, "betterment_safety");
    const retirementCash =
      valueFromSnapshot(snapshot, "betterment_retirement") +
      valueFromSnapshot(snapshot, "fidelity_retirement");
    const grossAssets = nonRetirementCash + retirementCash;
    const budgetDifference = budgetSettings.totalBudget - creditCardBalance;
    const remainingBudget = budgetDifference + budgetOffset;
    const dailyBudget =
      payCycle.daysRemaining > 0
        ? remainingBudget / payCycle.daysRemaining
        : 0;

    return {
      liabilities,
      nonRetirementCash,
      retirementCash,
      grossAssets,
      budgetDifference,
      remainingBudget,
      dailyBudget,
      creditCardBalance,
      checkingAvailable: chaseChecking,
      savingsReserve,
      netAssets: grossAssets - creditCardBalance,
      pendingByAccount,
      liabilityPendingByAccount,
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
  }, [
    accounts,
    accountTransactions,
    budgetOffset,
    initialPendingCardTransactions,
    payCycle.daysRemaining,
    pendingTransactions,
    snapshot,
    view,
  ]);

  const visibleAccountSections = useMemo(() => {
    const archivedKeys = new Set(snapshot?.archived_account_keys || []);
    return accountSections
      .map((section) => ({
        ...section,
        keys: section.keys.filter((key) => !archivedKeys.has(key)),
        totalKeys: section.totalKeys?.filter((key) => !archivedKeys.has(key)),
      }))
      .filter((section) => section.keys.length);
  }, [snapshot?.archived_account_keys]);

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
          body: JSON.stringify({
            note: transactionForm.note,
            account: transactionForm.account,
            expected_post_date: transactionForm.expected_post_date,
            amount: pendingTransactionAmount(transactionForm.amount, transactionForm.direction),
          }),
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
        direction: "debit" as "debit" | "credit",
        account: formOpenAccount || transactionForm.account,
        expected_post_date: nextBusinessDayString(),
      });
      setFormOpenAccount(null);
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
    settledAccounts: SnapshotAccountKey[];
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
    accountKey: SnapshotAccountKey,
    value: number,
  ) {
    setRegisterError("");

    try {
      await navigator.clipboard.writeText(value.toFixed(2));
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

  const loadAccountTransactions = useCallback(async (accountKey: SnapshotAccountKey) => {
    const filters = transactionAccountFilters[accountKey];
    if (!filters) {
      setAccountTransactions((current) => ({
        ...current,
        [accountKey]: {
          isLoading: false,
          error: "",
          transactions: [],
        },
      }));
      return;
    }

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
        account_key: accountKey,
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
  }, []);

  useEffect(() => {
    if (!expandedAccount) return;
    void loadAccountTransactions(expandedAccount);
  }, [expandedAccount, loadAccountTransactions, snapshot?.source_updated_at]);

  function updateAccountTransaction(
    accountKey: SnapshotAccountKey,
    updated: CreditCardTransaction,
  ) {
    setAccountTransactions((current) => {
      const state = current[accountKey];
      if (!state) return current;
      return {
        ...current,
        [accountKey]: {
          ...state,
          transactions: state.transactions.map((transaction) =>
            transaction.id === updated.id ? updated : transaction,
          ),
        },
      };
    });
  }

  function toggleAccountTransactions(accountKey: SnapshotAccountKey) {
    const nextAccount = expandedAccount === accountKey ? null : accountKey;
    setExpandedAccount(nextAccount);
  }

  function togglePendingTransactionForm(accountKey: SnapshotAccountKey) {
    setFormError("");
    setFormOpenAccount((current) => {
      if (current === accountKey) return null;
      setTransactionForm({
        note: "",
        amount: "",
        direction: "debit" as "debit" | "credit",
        account: accountKey,
        expected_post_date: nextBusinessDayString(),
      });
      return accountKey;
    });
  }

  function updatePendingTransactionForm(
    update: Partial<typeof transactionForm>,
  ) {
    setTransactionForm((current) => ({
      ...current,
      ...update,
    }));
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
      if (expandedAccount) void loadAccountTransactions(expandedAccount);
    } else {
      setRegisterError("Unable to mark the transaction cleared.");
    }
  }

  async function unmatchTransaction(pendingTransactionId: number) {
    setRegisterError("");
    const response = await fetch(
      `${APP_BASE_PATH}/api/pending-transactions/${pendingTransactionId}/reconciliation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo" }),
      },
    );
    const updated = (await response.json().catch(() => null)) as PendingTransaction | null;
    if (response.ok && updated?.id) {
      setPendingTransactions((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (expandedAccount) void loadAccountTransactions(expandedAccount);
    } else {
      setRegisterError("Unable to unmatch the transaction.");
    }
  }

  async function reconcileTransaction(
    transaction: PendingTransaction,
    action: "confirm" | "reject" | "undo",
  ) {
    setRegisterError("");
    const response = await fetch(
      `${APP_BASE_PATH}/api/pending-transactions/${transaction.id}/reconciliation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      },
    );
    const updated = (await response.json().catch(() => null)) as
      | PendingTransaction
      | null;
    if (response.ok && updated?.id) {
      setPendingTransactions((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (expandedAccount) void loadAccountTransactions(expandedAccount);
    } else {
      setRegisterError("Unable to update the transaction match.");
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

  function handlePendingDeleteClick(transaction: PendingTransaction) {
    if (confirmingDeleteId === transaction.id) {
      void deleteTransaction(transaction);
      return;
    }
    setConfirmingDeleteId(transaction.id);
  }

  const hasHomepageFinancialReminders =
    hasActiveHomepageFinancialReminders(initialFinancialReminders);

  return (
    <section>
      {view === "overview" ? (
        <OverviewFinancialBrief
          context={{ currentDate, snapshot, pendingTransactions,
            pendingCardTransactions: goalTransactions.length ? goalTransactions : initialPendingCardTransactions,
            transactions: goalTransactions, projectedNextPaycheck }}
          goals={initialFinancialGoals}
          grossAssets={calculations.grossAssets}
          netAssets={calculations.netAssets}
          budgetOffset={budgetOffset}
          attentionCount={calculations.overdrawnAccounts.length + (calculations.savingsReserve.variance < 0 ? 1 : 0) + initialFinancialReminders.filter(r => r.is_enabled !== false && r.active_on_homepage).length}
          attention={<>
            {calculations.overdrawnAccounts.map(account => (
              <div className="overview-attention-item is-overdrawn" role="alert" key={account.key}>
                <div><h3>Overdrawn account</h3><p>{account.label}: {formatCurrency(account.adjustedBalance)} adjusted balance.</p></div>
                <Link href="/dashboard/accounts">Review account →</Link>
              </div>
            ))}
            {calculations.savingsReserve.variance < 0 ? (
              <div className="overview-attention-item" role="alert">
                <div><h3>Savings reserve shortfall</h3><p><strong>{formatCurrency(calculations.savingsReserve.restorationNeeded)}</strong> below the {formatCurrency(calculations.savingsReserve.target)} target.</p><p>{accountDisplayName("chase_savings", budgetPlanSettings.account_display_names)} · Adjusted balance {formatCurrency(calculations.adjustedValue("chase_savings"))}</p></div>
                <Link href="/dashboard/accounts">Review account →</Link>
              </div>
            ) : null}
            {hasHomepageFinancialReminders ? <HomepageFinancialReminders reminders={initialFinancialReminders} /> : null}
          </>}
        />
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
            {registerError ? (
              <p
                className="mt-3 rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                role="alert"
              >
                {registerError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-5">
              {visibleAccountSections.map((section) => (
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
                      <span className="text-right">
                        {section.title === "Liability accounts"
                          ? "Posted"
                          : "Available"}
                      </span>
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
                const citiLabel = budgetPlanSettings.account_display_names?.citi_current?.trim() || "Citi Card";
                const currentPosted = valueFromSnapshot(snapshot, "citi_current");
                const pendingPosted = valueFromSnapshot(snapshot, "citi_pending");
                const currentManual =
                  calculations.liabilityPendingByAccount.get("citi_current") || 0;
                const pendingManual =
                  calculations.liabilityPendingByAccount.get("citi_pending") || 0;
                const totalPending =
                  pendingPosted +
                  currentManual +
                  pendingManual;
                const adjusted =
                  calculations.adjustedValue("citi_current") +
                  calculations.adjustedValue("citi_pending");
                const citiSettled =
                  calculations.settledAccounts.has("citi_current");

                const citiTransactions = accountTransactions.citi_current;
                const citiExpanded = expandedAccount === "citi_current";
                const citiManualPendingTransactions = pendingTransactions.filter(
                  (transaction) =>
                    !transaction.is_cleared &&
                    (transaction.account === "citi_current" ||
                      transaction.account === "citi_pending"),
                );
                return (
                  <div key="citi_card">
                    <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-x-5 border-b border-white/[0.07] px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem] sm:px-5">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <AccountTransactionToggle
                          accountLabel={citiLabel}
                          isExpanded={citiExpanded}
                          onClick={() => toggleAccountTransactions("citi_current")}
                        />
                        <span
                          className="min-w-0 flex-1 truncate text-sm text-white/75"
                          title={citiLabel}
                        >
                          {citiLabel}
                        </span>
                        <AccountLoginLink
                          urls={budgetPlanSettings?.account_login_urls}
                          accountKey="citi_current"
                          label={citiLabel}
                        />
                        <PaidActionButton
                          disabled={
                            citiSettled || currentPosted <= 0 || !!payingAccount
                          }
                          label={
                            citiSettled
                              ? `${citiLabel} is paid pending clearance`
                              : `Mark ${citiLabel} paid`
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
                        accountKey="citi_current"
                        accountLabel={citiLabel}
                        categories={expenseCategories}
                        confirmingDeleteId={confirmingDeleteId}
                        deletingId={deletingId}
                        error={citiTransactions?.error || ""}
                        formError={formError}
                        formOpen={formOpenAccount === "citi_current"}
                        isLoading={citiTransactions?.isLoading ?? true}
                        isSaving={isSaving}
                        manualPendingTransactions={citiManualPendingTransactions}
                        onChangeTransactionForm={updatePendingTransactionForm}
                        onDeleteTransaction={handlePendingDeleteClick}
                        onMarkCleared={markCleared}
                        onReconcile={reconcileTransaction}
                        onSubmitPendingTransaction={addPendingTransaction}
                        onTransactionUpdated={(updated) => updateAccountTransaction("citi_current", updated)}
                        onToggleForm={togglePendingTransactionForm}
                        onTagLibraryChanged={mergeExpenseTags}
                        onUnmatch={(id) => void unmatchTransaction(id)}
                        tagLibrary={expenseTags}
                        transactions={citiTransactions?.transactions || []}
                        transactionForm={transactionForm}
                      />
                    ) : null}
                  </div>
                );
                  }

                  const posted = valueFromSnapshot(snapshot, account.key);
                  const pending =
                    liabilityAccounts.has(account.key)
                      ? calculations.liabilityPendingByAccount.get(account.key) || 0
                      : calculations.pendingByAccount.get(account.key) || 0;
                  const adjusted = calculations.adjustedValue(account.key);
                  const overdrawn =
                    !liabilityAccounts.has(account.key) && adjusted < 0;
                  const compactLiability =
                    account.key === "chase_credit" ||
                    account.key === "chase_credit_8506" ||
                    account.key === "barclays_card";
                  const liabilitySettled = calculations.settledAccounts.has(
                    account.key,
                  );
                  const isInvestmentSection =
                    section.title === "Investments & retirement";
                  const canShowTransactions = true;
                  const isExpanded = expandedAccount === account.key;
                  const transactionState = accountTransactions[account.key];
                  const manualPendingTransactions = pendingTransactions.filter(
                    (transaction) =>
                      !transaction.is_cleared &&
                      transaction.account === account.key,
                  );
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
                        <div className="flex min-w-0 items-center gap-2">
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
                            className={`min-w-0 flex-1 truncate text-sm ${
                              overdrawn
                                ? "font-semibold text-rose-200"
                                : "text-white/75"
                            }`}
                            title={account.label}
                          >
                            {account.label}
                          </span>
                          <AccountLoginLink
                            urls={budgetPlanSettings?.account_login_urls}
                            accountKey={account.key}
                            label={account.label}
                          />
                          {account.key === "chase_checking" ? (
                            <AdjustedReserveCopyButton
                              copied={
                                copiedAdjustedAccount === "chase_checking"
                              }
                              disabled={!snapshot}
                              label={`Copy ${account.label} adjusted total minus $500`}
                              onClick={() =>
                                copyAdjustedReserveValue(account.key, adjusted - 500)
                              }
                            />
                          ) : null}
                          {account.key === "chase_savings" ? (
                            <AdjustedReserveCopyButton
                              copied={
                                copiedAdjustedAccount === "chase_savings"
                              }
                              disabled={!snapshot}
                              label={`Copy $30,000 minus ${account.label} adjusted total`}
                              onClick={() =>
                                copyAdjustedReserveValue(account.key, 30_000 - adjusted)
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
                          accountKey={account.key}
                          accountLabel={account.label}
                          categories={expenseCategories}
                          confirmingDeleteId={confirmingDeleteId}
                          deletingId={deletingId}
                          error={transactionState?.error || ""}
                          formError={formError}
                          formOpen={formOpenAccount === account.key}
                          isLoading={transactionState?.isLoading ?? true}
                          isSaving={isSaving}
                          manualPendingTransactions={manualPendingTransactions}
                          onChangeTransactionForm={updatePendingTransactionForm}
                          onDeleteTransaction={handlePendingDeleteClick}
                          onMarkCleared={markCleared}
                          onReconcile={reconcileTransaction}
                          onSubmitPendingTransaction={addPendingTransaction}
                          onTransactionUpdated={(updated) => updateAccountTransaction(account.key, updated)}
                          onToggleForm={togglePendingTransactionForm}
                          onTagLibraryChanged={mergeExpenseTags}
                          onUnmatch={(id) => void unmatchTransaction(id)}
                          tagLibrary={expenseTags}
                          transactions={transactionState?.transactions || []}
                          transactionForm={transactionForm}
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
                        ? "liability-account-total-value text-rose-200"
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
              label="Credit card balance"
              value={formatCurrency(calculations.creditCardBalance)}
              negative={calculations.creditCardBalance > 0}
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
