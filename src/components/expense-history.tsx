"use client";

import { FormEvent, useState } from "react";

import type { BudgetItem } from "@/lib/budget-item-types";
import { APP_BASE_PATH } from "@/lib/config";
import { creditCardExpenditureAverages, effectiveCreditCardTransactionAmount } from "@/lib/credit-card-averages";
import type { CreditCardTransaction, ExpenseTag } from "@/lib/credit-card-transaction-types";
import type { ExpenseCategory } from "@/lib/expense-category-types";
import {
  budgetItemExpenseAverages,
  effectiveExpenseAmount,
  scaleExpenseAverages,
} from "@/lib/expense-averages";
import {
  defaultExpenseDateRange,
  mergeExpenseDateRange,
  type ExpenseDateRange,
  formatExpenseDateRange,
} from "@/lib/expense-date-range";
import type { ExpenseEntry } from "@/lib/expense-entry-types";
import {
  validateCreditCardImportFiles,
  validatePdfImportFiles,
} from "@/lib/pdf-import";
import { useBudgetData } from "@/components/budget-data-provider";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  normalizeCurrencyInput,
  normalizeDateInput,
} from "@/lib/form-input-normalization";
import { categoryLabelMap, sortedCategoryOptions } from "@/lib/transaction-categories";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00`));
}

function todayString() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

export function ExpenseHistory({
  initialCategories = [],
  initialTags,
}: {
  initialCategories?: ExpenseCategory[];
  initialTags: ExpenseTag[];
}) {
  const {
    budgetItems: items,
    setBudgetItems: setItems,
    expenseEntries: entries,
    setExpenseEntries: setEntries,
    creditCardTransactions,
    setCreditCardTransactions,
    expenseCategories,
  } = useBudgetData();
  const [tagLibrary, setTagLibrary] = useState(initialTags);
  const [openItemId, setOpenItemId] = useState<number | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [updatingSharedItemId, setUpdatingSharedItemId] = useState<number | null>(
    null,
  );
  const [updatingExcludeEntryId, setUpdatingExcludeEntryId] = useState<
    number | null
  >(null);
  const [importingItemId, setImportingItemId] = useState<number | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);
  const [expandedTransactionItems, setExpandedTransactionItems] = useState<
    Record<number, boolean>
  >({});
  const [importMessage, setImportMessage] = useState("");
  const [categorizing, setCategorizing] = useState(false);
  const [spendingDateRange, setSpendingDateRange] = useState<ExpenseDateRange>(
    () => defaultExpenseDateRange(),
  );
  const [expandedSpendingCategory, setExpandedSpendingCategory] = useState<
    string | null
  >(null);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [correctingTransactionId, setCorrectingTransactionId] = useState<
    number | null
  >(null);
  const [savingCorrectionId, setSavingCorrectionId] = useState<number | null>(
    null,
  );
  const [correctionRuleForm, setCorrectionRuleForm] = useState({
    match_type: "exact" as "exact" | "starts_with",
    match_value: "",
    category: "dining",
  });
  const [taggingTransactionId, setTaggingTransactionId] = useState<number | null>(null);
  const [savingTagsId, setSavingTagsId] = useState<number | null>(null);
  const [savingBudgetFlagsId, setSavingBudgetFlagsId] = useState<number | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagFormOpen, setNewTagFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [entryForm, setEntryForm] = useState({
    incurredOn: todayString(),
    amount: "",
    note: "",
    excludeFromCreditCard: false,
  });
  const [dateRanges, setDateRanges] = useState<Record<number, ExpenseDateRange>>(
    () =>
      Object.fromEntries(
        items.map((item) => [item.id, defaultExpenseDateRange()]),
      ),
  );
  const today = todayString();
  const categoryList = expenseCategories.length ? expenseCategories : initialCategories;
  const categoryLabels = categoryLabelMap(categoryList);
  const categoryOptions = sortedCategoryOptions(categoryList);
  const normalizedTransactionSearch = transactionSearch.trim().toLocaleLowerCase();
  const categorizedTransactions = creditCardTransactions.filter((item) => {
    if (
      !item.category ||
      (item.category === "account_payment" && item.include === false) ||
      !["purchase", "fee", "interest"].includes(item.transaction_type)
    ) {
      return false;
    }
    if (normalizedTransactionSearch) {
      return [
        item.description,
        item.issuer,
        item.account_last_four,
        item.transaction_date,
        item.amount,
        item.note,
        item.category,
        categoryLabels[item.category],
        ...(item.tags || []).map((tag) => tag.name),
      ].some((value) => String(value || "").toLocaleLowerCase().includes(normalizedTransactionSearch));
    }
    return (
      item.transaction_date >= spendingDateRange.start &&
      item.transaction_date <= spendingDateRange.end
    );
  });
  const categoryTotals = Object.entries(
    categorizedTransactions
      .reduce<Record<string, number>>((totals, item) => {
        totals[item.category] = (totals[item.category] || 0) + effectiveCreditCardTransactionAmount(item);
        return totals;
      }, {}),
  ).sort((left, right) => left[0] === "needs_review" ? -1 : right[0] === "needs_review" ? 1 : right[1] - left[1]);
  const categorizedTotal = categoryTotals.reduce((sum, [, amount]) => sum + amount, 0);
  const earliestTransactionDate = creditCardTransactions.reduce(
    (earliest, item) =>
      !earliest || item.transaction_date < earliest
        ? item.transaction_date
        : earliest,
    "",
  );
  const availableTagNames = tagLibrary
    .map((tag) => tag.name)
    .sort((left, right) => left.localeCompare(right));

  function updateTransactionTag(transactionId: number, name: string, enabled: boolean) {
    const cleaned = name.trim();
    if (!cleaned) return;
    const next = enabled
      ? tagDraft.some((tag) => tag.toLowerCase() === cleaned.toLowerCase()) ? tagDraft : [...tagDraft, cleaned]
      : tagDraft.filter((tag) => tag.toLowerCase() !== cleaned.toLowerCase());
    setTagDraft(next);
    setNewTagName("");
    setNewTagFormOpen(false);
    void saveTransactionTags(transactionId, next);
  }

  function openTransactionEditor(transaction: CreditCardTransaction) {
    setTaggingTransactionId(transaction.id);
    setTagDraft((transaction.tags || []).map((tag) => tag.name));
    setNewTagName("");
    setNewTagFormOpen(false);
    setNoteDraft(transaction.note || "");
    setCorrectingTransactionId(transaction.id);
    setCorrectionRuleForm({
      match_type: "exact",
      match_value: transaction.description,
      category: transaction.category === "needs_review" ? "dining" : transaction.category,
    });
  }

  function closeTransactionEditor() {
    setTaggingTransactionId(null);
    setCorrectingTransactionId(null);
  }

  async function saveTransactionTags(transactionId: number, tags: string[]) {
    setSavingTagsId(transactionId);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transactionId}/update-tags?include_unbudgeted=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags }),
        },
      );
      const updated = await response.json().catch(() => null) as CreditCardTransaction | { message?: string } | null;
      if (!response.ok || !updated || !("id" in updated)) throw new Error(updated && "message" in updated ? updated.message : "Unable to save tags.");
      setCreditCardTransactions((current) => current.map((item) => item.id === updated.id ? updated : item));
      setTagLibrary((current) => {
        const byName = new Map(current.map((tag) => [tag.name.toLowerCase(), tag]));
        updated.tags.forEach((tag) => byName.set(tag.name.toLowerCase(), tag));
        return Array.from(byName.values());
      });
      setTagDraft(updated.tags.map((tag) => tag.name));
    } catch (tagError) {
      setError(tagError instanceof Error ? tagError.message : "Unable to save tags.");
    } finally {
      setSavingTagsId(null);
    }
  }

  async function updateTransactionBudgetFlags(transaction: CreditCardTransaction, patch: Partial<Pick<CreditCardTransaction, "split" | "include">>) {
    setSavingBudgetFlagsId(transaction.id);
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/update-budget-flags?include_unbudgeted=true`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const updated = await response.json().catch(() => null) as CreditCardTransaction | { message?: string } | null;
      if (!response.ok || !updated || !("id" in updated)) throw new Error(updated && "message" in updated ? updated.message : "Unable to update this transaction.");
      setCreditCardTransactions((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update this transaction.");
    } finally {
      setSavingBudgetFlagsId(null);
    }
  }

  async function saveTransactionNote(transactionId: number) {
    setSavingNoteId(transactionId);
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/credit-card-transactions/${transactionId}/update-note?include_unbudgeted=true`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: noteDraft }),
      });
      const updated = await response.json().catch(() => null) as CreditCardTransaction | { message?: string } | null;
      if (!response.ok || !updated || !("id" in updated)) throw new Error(updated && "message" in updated ? updated.message : "Unable to save the transaction note.");
      setCreditCardTransactions((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNoteDraft(updated.note);
      return true;
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Unable to save the transaction note.");
      return false;
    } finally {
      setSavingNoteId(null);
    }
  }

  async function saveTransactionEditor(transactionId: number) {
    if (await saveTransactionNote(transactionId)) {
      if (await correctTransactionCategory(transactionId)) {
        closeTransactionEditor();
      }
    }
  }

  function transactionBudgetControls(transaction: CreditCardTransaction) {
    const saving = savingBudgetFlagsId === transaction.id;
    return <div className="flex items-center gap-1.5">
      <button aria-pressed={transaction.split} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition disabled:opacity-50 ${transaction.split ? "border-violet-300/30 bg-violet-400/15 text-violet-100" : "border-white/10 text-white/45 hover:text-white/70"}`} disabled={saving} onClick={() => void updateTransactionBudgetFlags(transaction, { split: !transaction.split })} type="button">Split</button>
      <button aria-pressed={transaction.include} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition disabled:opacity-50 ${transaction.include ? "border-accent/25 bg-accent/10 text-accent" : "border-rose-300/20 bg-rose-400/10 text-rose-100"}`} disabled={saving} onClick={() => void updateTransactionBudgetFlags(transaction, { include: !transaction.include })} type="button">{transaction.include ? "Included" : "Excluded"}</button>
    </div>;
  }

  async function correctTransactionCategory(transactionId: number) {
    if (!correctionRuleForm.category || !correctionRuleForm.match_value.trim()) return false;
    setSavingCorrectionId(transactionId);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transactionId}/correct-category?include_unbudgeted=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(correctionRuleForm),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | {
            updated_count: number;
            transactions: CreditCardTransaction[];
            message?: string;
          }
        | null;
      if (!response.ok || !result?.transactions) {
        throw new Error(result?.message || "Unable to correct the category.");
      }
      const refreshed = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions?include_unbudgeted=true`,
        { cache: "no-store" },
      );
      if (!refreshed.ok) {
        throw new Error(
          "The rule was saved, but the updated transactions could not be refreshed.",
        );
      }
      setCreditCardTransactions(
        (await refreshed.json()) as CreditCardTransaction[],
      );
      setImportMessage(
        `Category corrected and learned for ${result.updated_count} matching ${result.updated_count === 1 ? "transaction" : "transactions"}.`,
      );
      setCorrectionRuleForm({ match_type: "exact", match_value: "", category: "dining" });
      return true;
    } catch (correctionError) {
      setError(
        correctionError instanceof Error
          ? correctionError.message
          : "Unable to correct the category.",
      );
      return false;
    } finally {
      setSavingCorrectionId(null);
    }
  }

  async function categorizeExpenses() {
    setCategorizing(true); setError(""); setImportMessage("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/credit-card-transactions?include_unbudgeted=true`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const result = await response.json().catch(() => null) as { categorized_count?: number; message?: string } | null;
      if (!response.ok) throw new Error(result?.message || "Unable to categorize expenses.");
      const refreshed = await fetch(`${APP_BASE_PATH}/api/credit-card-transactions?include_unbudgeted=true`, { cache: "no-store" });
      if (!refreshed.ok) throw new Error("Expenses were categorized, but the chart could not refresh.");
      setCreditCardTransactions(await refreshed.json() as CreditCardTransaction[]);
      setImportMessage(`Categorized ${result?.categorized_count || 0} new expenses.`);
    } catch (categoryError) {
      setError(categoryError instanceof Error ? categoryError.message : "Unable to categorize expenses.");
    } finally { setCategorizing(false); }
  }

  async function addEntry(
    event: FormEvent<HTMLFormElement>,
    budgetItemId: number,
  ) {
    event.preventDefault();
    const normalizedAmount = normalizeCurrencyInput(entryForm.amount);
    const amount = Number(normalizedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setSavingItemId(budgetItemId);
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/expense-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget_item: budgetItemId,
          incurred_on: entryForm.incurredOn,
          amount: amount.toFixed(2),
          note: entryForm.note.trim(),
          exclude_from_credit_card: entryForm.excludeFromCreditCard,
        }),
      });
      const created = (await response.json().catch(() => null)) as
        | ExpenseEntry
        | { message?: string }
        | null;
      if (!response.ok || !created || !("id" in created)) {
        throw new Error(
          created && "message" in created && created.message
            ? created.message
            : "Unable to add the expense entry.",
        );
      }
      setEntries((current) => [created, ...current]);
      setEntryForm({
        incurredOn: todayString(),
        amount: "",
        note: "",
        excludeFromCreditCard: false,
      });
      setOpenItemId(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to add the expense entry.",
      );
    } finally {
      setSavingItemId(null);
    }
  }

  async function toggleSharedCost(item: BudgetItem, isSharedCost: boolean) {
    setUpdatingSharedItemId(item.id);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/budget-items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_shared_cost: isSharedCost }),
        },
      );
      const updated = (await response.json().catch(() => null)) as
        | BudgetItem
        | { message?: string }
        | null;
      if (!response.ok || !updated || !("id" in updated)) {
        throw new Error(
          updated && "message" in updated && updated.message
            ? updated.message
            : "Unable to update the expense.",
        );
      }
      setItems((current) =>
        current.map((budgetItem) =>
          budgetItem.id === item.id ? updated : budgetItem,
        ),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update the expense.",
      );
    } finally {
      setUpdatingSharedItemId(null);
    }
  }

  async function toggleExcludeFromCreditCard(
    entry: ExpenseEntry,
    excludeFromCreditCard: boolean,
  ) {
    setUpdatingExcludeEntryId(entry.id);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/expense-entries/${entry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exclude_from_credit_card: excludeFromCreditCard,
          }),
        },
      );
      const updated = (await response.json().catch(() => null)) as
        | ExpenseEntry
        | { message?: string }
        | null;
      if (!response.ok || !updated || !("id" in updated)) {
        throw new Error(
          updated && "message" in updated && updated.message
            ? updated.message
            : "Unable to update the expense entry.",
        );
      }
      setEntries((current) =>
        current.map((candidate) =>
          candidate.id === entry.id ? updated : candidate,
        ),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update the expense entry.",
      );
    } finally {
      setUpdatingExcludeEntryId(null);
    }
  }

  async function deleteEntry(entryId: number) {
    setDeletingId(entryId);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/expense-entries/${entryId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Unable to delete the expense entry.");
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
      setConfirmingDeleteId(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the expense entry.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function importExpenseFiles(item: BudgetItem, files: File[]) {
    const validationError =
      item.key === "credit-card"
        ? validateCreditCardImportFiles(files)
        : validatePdfImportFiles(files);
    if (validationError) {
      setImportMessage("");
      setError(validationError);
      return;
    }

    setImportingItemId(item.id);
    setError("");
    setImportMessage("");
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      const importKind =
        item.key === "power"
          ? "power"
          : item.key === "credit-card"
            ? "credit-card"
            : "housing";
      const importPath =
        item.key === "credit-card"
          ? `import-${importKind}`
          : `import-${importKind}-pdf`;
      const response = await fetch(
        `${APP_BASE_PATH}/api/budget-items/${item.id}/${importPath}`,
        {
          method: "POST",
          body: formData,
        },
      );
      const result = (await response.json().catch(() => null)) as
        | {
            created: Array<ExpenseEntry | CreditCardTransaction>;
            created_count: number;
            duplicate_count: number;
            file_count: number;
            error_count: number;
            errors: Array<{ file: string; detail: string }>;
          }
        | { detail?: string; message?: string }
        | null;
      if (!response.ok || !result || !("created" in result)) {
        throw new Error(
          result && "detail" in result && result.detail
            ? result.detail
            : result && "message" in result && result.message
              ? result.message
              : `Unable to import the ${item.label.toLowerCase()} files.`,
        );
      }
      if (result.created.length) {
        if (item.key === "credit-card") {
          const imported = result.created as CreditCardTransaction[];
          setCreditCardTransactions((current) => [...imported, ...current]);

          const importedDates = imported.flatMap((entry) => [
            entry.transaction_date,
            entry.statement_start,
            entry.statement_end,
          ]);
          if (importedDates.length) {
            const importedRange = {
              start: importedDates.reduce((min, value) =>
                value < min ? value : min,
              ),
              end: importedDates.reduce((max, value) =>
                value > max ? value : max,
              ),
            };
            setDateRanges((current) => ({
              ...current,
              [item.id]: mergeExpenseDateRange(current[item.id], importedRange),
            }));
            setExpandedTransactionItems((current) => ({
              ...current,
              [item.id]: true,
            }));
          }
        } else {
          setEntries((current) => [
            ...(result.created as ExpenseEntry[]),
            ...current,
          ]);
        }
      }
      const createdText =
        result.created_count === 1
          ? item.key === "credit-card"
            ? "Imported 1 transaction."
            : "Imported 1 expense."
          : item.key === "credit-card"
            ? `Imported ${result.created_count} transactions.`
            : `Imported ${result.created_count} expenses.`;
      const duplicateText = result.duplicate_count
        ? ` ${result.duplicate_count} duplicate ${
            result.duplicate_count === 1 ? "was" : "were"
          } skipped.`
        : "";
      const errorText = result.error_count
        ? ` ${result.error_count} ${
            result.error_count === 1 ? "file" : "files"
          } failed: ${result.errors
            .map((item) => `${item.file} (${item.detail})`)
            .join("; ")}`
        : "";
      const rangeText =
        item.key === "credit-card" && result.created_count
          ? " Date range expanded to include the imported statement."
          : "";
      setImportMessage(`${createdText}${duplicateText}${errorText}${rangeText}`);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : `Unable to import the ${item.label.toLowerCase()} files.`,
      );
    } finally {
      setImportingItemId(null);
    }
  }

  return (
    <div className="mt-8">
      {error ? (
        <p
          className="mb-5 rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {importMessage ? (
        <p
          className="mb-5 rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="status"
        >
          {importMessage}
        </p>
      ) : null}

      <section className="surface mb-5 rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Spending by type</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Categorized expenses</h2>
            <p className="mt-1 text-sm text-muted">{currencyFormatter.format(categorizedTotal)} across {categoryTotals.length} categories</p></div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="relative min-w-56 flex-1 sm:flex-none">
              <span className="sr-only">Search transactions</span>
              <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/35">⌕</span>
              <input
                className="h-9 w-full rounded-lg border border-white/10 bg-black/20 pl-8 pr-8 text-xs text-white outline-none placeholder:text-white/35 focus:border-accent/40 sm:w-64"
                onChange={(event) => {
                  setTransactionSearch(event.target.value);
                  setExpandedSpendingCategory(null);
                }}
                placeholder="Search transactions"
                type="search"
                value={transactionSearch}
              />
              {transactionSearch ? <button
                aria-label="Clear transaction search"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-sm text-white/40 hover:text-white"
                onClick={() => setTransactionSearch("")}
                type="button"
              >×</button> : null}
            </label>
            <DateRangePicker
              allTimeStart={earliestTransactionDate || undefined}
              dialogLabel="Select spending graph date range"
              onApply={(range) => {
                setSpendingDateRange(range);
                setExpandedSpendingCategory(null);
              }}
              range={spendingDateRange}
            />
            <button className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50"
              disabled={categorizing} onClick={() => void categorizeExpenses()} type="button">
              {categorizing ? "Categorizing…" : "Categorize new expenses"}
            </button>
          </div>
        </div>
        {categoryTotals.length ? <div className="mt-5 space-y-2">
          {categoryTotals.map(([category, amount]) => {
            const isExpanded = expandedSpendingCategory === category;
            const categoryTransactions = categorizedTransactions
              .filter((transaction) => transaction.category === category)
              .sort((left, right) =>
                right.transaction_date.localeCompare(left.transaction_date) ||
                right.id - left.id,
              );
            return <div className="overflow-hidden rounded-xl border border-white/[0.07]" key={category}>
              <button
                aria-expanded={isExpanded}
                className="w-full px-3 py-3 text-left transition hover:bg-white/[0.035]"
                onClick={() => setExpandedSpendingCategory(isExpanded ? null : category)}
                type="button"
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 text-white/75">
                    <span aria-hidden="true" className={`text-accent transition ${isExpanded ? "rotate-90" : ""}`}>›</span>
                    {categoryLabels[category] || category}
                    <span className="text-muted">{categoryTransactions.length}</span>
                  </span>
                  <span className="font-mono text-white">{currencyFormatter.format(amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-accent" style={{ width: `${categorizedTotal ? Math.max(2, amount / categorizedTotal * 100) : 0}%` }} /></div>
              </button>
              {isExpanded ? <div className="divide-y divide-white/[0.06] border-t border-white/[0.07] bg-black/10">
                {categoryTransactions.map((transaction) => <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3" key={transaction.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{transaction.description}</p>
                    <p className="mt-1 text-xs text-muted">{formatDate(transaction.transaction_date)} · {transaction.issuer} •••• {transaction.account_last_four}</p>
                    {transaction.note ? <p className="mt-2 text-xs italic text-white/60">{transaction.note}</p> : null}
                    {transaction.tags?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{transaction.tags.map((tag) => <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium text-sky-100" key={tag.id}>{tag.name}</span>)}</div> : null}
                    {taggingTransactionId === transaction.id ? <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/10 p-3">
                      <div className="mt-3 flex flex-wrap gap-2">{tagDraft.map((tag) => <button className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2.5 py-1 text-[11px] text-sky-100 disabled:opacity-50" disabled={savingTagsId === transaction.id} key={tag} onClick={() => updateTransactionTag(transaction.id, tag, false)} title="Remove tag" type="button">{tag} ×</button>)}</div>
                      <div className="mt-3 flex items-center gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Available tags</p><button aria-label="Create a new tag" className="grid size-6 place-items-center rounded-full border border-white/10 text-sm text-white/60 transition hover:border-sky-300/30 hover:text-sky-100" onClick={() => setNewTagFormOpen((current) => !current)} title="Create a new tag" type="button">+</button></div>
                      {availableTagNames.filter((tag) => !tagDraft.some((selected) => selected.toLowerCase() === tag.toLowerCase())).length ? <div className="mt-2 flex flex-wrap gap-2">{availableTagNames.filter((tag) => !tagDraft.some((selected) => selected.toLowerCase() === tag.toLowerCase())).map((tag) => <button className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/60 hover:border-sky-300/20 hover:text-sky-100 disabled:opacity-50" disabled={savingTagsId === transaction.id} key={tag} onClick={() => updateTransactionTag(transaction.id, tag, true)} type="button">+ {tag}</button>)}</div> : <p className="mt-2 text-[11px] text-muted">No other saved tags.</p>}
                      {newTagFormOpen ? <div className="mt-3 flex flex-wrap gap-2">
                        <input className="h-9 min-w-48 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50" maxLength={40} onChange={(event) => setNewTagName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); updateTransactionTag(transaction.id, newTagName, true); } }} placeholder="Create a tag" value={newTagName} />
                        <button className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70" onClick={() => updateTransactionTag(transaction.id, newTagName, true)} type="button">Add</button>
                      </div> : null}
                      {savingTagsId === transaction.id ? <p className="mt-3 text-xs text-muted">Saving tag changes…</p> : null}
                      <label className="mt-4 block border-t border-white/[0.07] pt-3"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Transaction note</span><textarea className="mt-2 min-h-20 w-full resize-y rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-xs text-white outline-none focus:border-accent/50" maxLength={2000} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add context about this transaction" value={noteDraft} /></label>
                      <div className="mt-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Budget treatment</p>{transactionBudgetControls(transaction)}</div>
                    </div> : null}
                    {correctingTransactionId === transaction.id ? <div className="mt-3 grid items-center gap-2 sm:grid-cols-[auto_minmax(12rem,1fr)_auto_auto_auto]">
                      <select
                        aria-label="Match condition"
                        className="h-9 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50"
                        onChange={(event) => setCorrectionRuleForm((current) => ({ ...current, match_type: event.target.value as "exact" | "starts_with" }))}
                        value={correctionRuleForm.match_type}
                      >
                        <option value="exact">Equals</option><option value="starts_with">Starts with</option>
                      </select>
                      <input aria-label="Match value" className="h-9 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50" onChange={(event) => setCorrectionRuleForm((current) => ({ ...current, match_value: event.target.value }))} value={correctionRuleForm.match_value} />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Set category</span>
                      <select aria-label={`Correct category for ${transaction.description}`} className="h-9 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50" onChange={(event) => setCorrectionRuleForm((current) => ({ ...current, category: event.target.value }))} value={correctionRuleForm.category}>{categoryOptions.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select>
                      <div className="flex items-center gap-2">
                      <button
                        className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50"
                        disabled={savingCorrectionId === transaction.id || savingNoteId === transaction.id}
                        onClick={() => void saveTransactionEditor(transaction.id)}
                        type="button"
                      >{savingCorrectionId === transaction.id || savingNoteId === transaction.id ? "Saving…" : "Save"}</button>
                      <button className="px-2 py-2 text-xs text-muted hover:text-white" onClick={closeTransactionEditor} type="button">Cancel</button>
                      </div>
                      <p className="text-[11px] text-muted sm:col-span-5">Creates an editable automation rule, updates matching history, and remembers it for future imports.</p>
                    </div> : null}
                  </div>
                  <div className="flex items-center gap-3 self-start">
                    <p className="font-mono text-sm font-semibold text-white">{currencyFormatter.format(effectiveCreditCardTransactionAmount(transaction))}</p>
                    <button
                      className="text-xs font-medium text-white/50 hover:text-accent"
                      onClick={() => openTransactionEditor(transaction)}
                      type="button"
                    >Edit</button>
                  </div>
                </div>)}
              </div> : null}
            </div>;
          })}
        </div> : <p className="mt-5 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted">{normalizedTransactionSearch ? `No transactions match “${transactionSearch.trim()}”.` : "No categorized expenses were found in this date range."}</p>}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {items.map((item) => {
          const dateRange =
            dateRanges[item.id] || defaultExpenseDateRange();
          const relevantEntries = entries
            .filter(
              (entry) =>
                entry.budget_item === item.id &&
                entry.incurred_on >= dateRange.start &&
                entry.incurred_on <= dateRange.end,
            )
            .sort((left, right) =>
              right.incurred_on.localeCompare(left.incurred_on),
            );
          const historicalEntries = relevantEntries.filter(
            (entry) => entry.incurred_on <= today,
          );
          const upcomingEntries = relevantEntries.filter(
            (entry) => entry.incurred_on > today,
          );
          const itemCreditCardTransactions = creditCardTransactions
            .filter(
              (entry) =>
                item.key === "credit-card" &&
                entry.budget_item === item.id &&
                entry.transaction_date >= dateRange.start &&
                entry.transaction_date <= dateRange.end,
            )
            .sort(
              (left, right) =>
                right.transaction_date.localeCompare(left.transaction_date) ||
                (right.posting_date || "").localeCompare(
                  left.posting_date || "",
                ) ||
                right.id - left.id,
            );
          const creditCardAverages = scaleExpenseAverages(
            creditCardExpenditureAverages(
              itemCreditCardTransactions,
              dateRange.start,
              dateRange.end,
            ),
            item.is_shared_cost,
          );
          const expenseAverages = budgetItemExpenseAverages(
            item,
            entries,
            creditCardTransactions,
            dateRange,
            today,
            items,
          );
          const historyEntryCount =
            historicalEntries.length + itemCreditCardTransactions.length;
          const rangeTotal = relevantEntries
            .filter((entry) => entry.incurred_on <= today)
            .reduce(
              (total, entry) =>
                total + effectiveExpenseAmount(entry.amount, item.is_shared_cost),
              0,
            );

          return (
            <article
              className="surface overflow-hidden rounded-2xl"
              key={item.id}
            >
              <div className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    {item.label}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {formatExpenseDateRange(dateRange)} · {historyEntryCount}{" "}
                    {historyEntryCount === 1 ? "entry" : "entries"}
                    {upcomingEntries.length
                      ? ` · ${upcomingEntries.length} upcoming`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65"
                    title="Shared cost (your share is half the amount)"
                  >
                    <input
                      checked={item.is_shared_cost}
                      className="size-4 rounded border-white/20 bg-black/20 text-accent focus:ring-accent/40 disabled:opacity-50"
                      disabled={updatingSharedItemId === item.id}
                      onChange={(event) =>
                        void toggleSharedCost(item, event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>Shared</span>
                  </label>
                  {["housing", "power", "credit-card"].includes(item.key) ? (
                    <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/65 transition hover:border-accent/20 hover:text-accent">
                      {importingItemId === item.id
                        ? "Importing…"
                        : "Import"}
                      <input
                        accept={
                          item.key === "credit-card"
                            ? "application/pdf,.pdf,text/csv,.csv"
                            : "application/pdf,.pdf"
                        }
                        className="sr-only"
                        disabled={importingItemId === item.id}
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          if (files.length) {
                            void importExpenseFiles(item, files);
                          }
                          event.target.value = "";
                        }}
                        type="file"
                      />
                    </label>
                  ) : null}
                  <button
                    className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/15"
                    onClick={() => {
                      setOpenItemId((current) =>
                        current === item.id ? null : item.id,
                      );
                      setError("");
                    }}
                    type="button"
                  >
                    {openItemId === item.id ? "Cancel" : "Add entry"}
                  </button>
                </div>
                </div>
                <DateRangePicker
                  range={dateRange}
                  onApply={(nextRange) =>
                    setDateRanges((current) => ({
                      ...current,
                      [item.id]: nextRange,
                    }))
                  }
                />
              </div>

              <div
                className="grid grid-cols-2 border-b border-white/[0.07] bg-black/10 lg:grid-cols-4"
              >
                <div className="border-r border-white/[0.07] px-4 py-3 sm:px-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {item.key === "credit-card"
                      ? "Expenditure total"
                      : "Range total"}
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-accent">
                    {currencyFormatter.format(
                      item.key === "credit-card"
                        ? creditCardAverages.total
                        : rangeTotal,
                    )}
                  </p>
                </div>
                <div className="px-4 py-3 sm:px-5 lg:border-r lg:border-white/[0.07]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Daily average
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-white">
                    {currencyFormatter.format(expenseAverages.daily)}
                  </p>
                </div>
                <div className="border-r border-t border-white/[0.07] px-4 py-3 sm:px-5 lg:border-t-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Weekly average
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-white">
                    {currencyFormatter.format(expenseAverages.weekly)}
                  </p>
                </div>
                <div className="border-t border-white/[0.07] px-4 py-3 sm:px-5 lg:border-t-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Monthly average
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-white">
                    {currencyFormatter.format(expenseAverages.monthly)}
                  </p>
                </div>
              </div>

              {openItemId === item.id ? (
                <form
                  className="grid gap-3 border-b border-white/[0.07] bg-black/10 p-4 sm:grid-cols-2 sm:p-5"
                  onSubmit={(event) => addEntry(event, item.id)}
                >
                  <label>
                    <span className="mb-2 block text-xs font-medium text-muted">
                      Date
                    </span>
                    <input
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-accent/50"
                      onChange={(event) =>
                        setEntryForm((current) => ({
                          ...current,
                          incurredOn: event.target.value,
                        }))
                      }
                      onPaste={(event) => {
                        const date = normalizeDateInput(
                          event.clipboardData.getData("text"),
                        );
                        if (!date) return;
                        event.preventDefault();
                        setEntryForm((current) => ({
                          ...current,
                          incurredOn: date,
                        }));
                      }}
                      required
                      type="date"
                      value={entryForm.incurredOn}
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-medium text-muted">
                      Amount
                    </span>
                    <input
                      autoComplete="off"
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-right font-mono text-sm text-white outline-none focus:border-accent/50"
                      data-1p-ignore
                      data-op-ignore
                      inputMode="decimal"
                      onChange={(event) => {
                        const amount = normalizeCurrencyInput(
                          event.target.value,
                        );
                        if (amount === null) return;
                        setEntryForm((current) => ({ ...current, amount }));
                      }}
                      placeholder="0.00"
                      required
                      type="text"
                      value={entryForm.amount}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-2 block text-xs font-medium text-muted">
                      Note
                    </span>
                    <input
                      autoComplete="off"
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-accent/50"
                      data-1p-ignore
                      data-op-ignore
                      maxLength={255}
                      onChange={(event) =>
                        setEntryForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                      placeholder="Optional details"
                      type="text"
                      value={entryForm.note}
                    />
                  </label>
                  {item.key !== "credit-card" ? (
                    <label
                      className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/15 px-3 py-3 sm:col-span-2"
                      title="Deduct this expense from the credit card total so it is not double counted"
                    >
                      <input
                        checked={entryForm.excludeFromCreditCard}
                        className="mt-0.5 size-4 rounded border-white/20 bg-black/20 text-accent focus:ring-accent/40"
                        onChange={(event) =>
                          setEntryForm((current) => ({
                            ...current,
                            excludeFromCreditCard: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      <span>
                        <span className="block text-sm text-white/80">
                          Exclude from credit card
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          Use when this expense was paid on a credit card and
                          should be deducted from the card total.
                        </span>
                      </span>
                    </label>
                  ) : null}
                  <button
                    className="h-10 rounded-lg bg-accent-strong px-4 text-sm font-semibold text-[#03120c] transition hover:bg-accent disabled:opacity-50 sm:col-span-2"
                    disabled={savingItemId === item.id}
                    type="submit"
                  >
                    {savingItemId === item.id ? "Saving…" : "Save entry"}
                  </button>
                </form>
              ) : null}

              {relevantEntries.length || itemCreditCardTransactions.length ? (
                <div>
                  {item.key === "credit-card" ? (
                    <button
                      aria-expanded={Boolean(expandedTransactionItems[item.id])}
                      className="flex w-full items-center justify-between border-b border-white/[0.07] bg-white/[0.025] px-4 py-3.5 text-left transition hover:bg-white/[0.045] sm:px-5"
                      onClick={() =>
                        setExpandedTransactionItems((current) => ({
                          ...current,
                          [item.id]: !current[item.id],
                        }))
                      }
                      type="button"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white/85">
                          Transactions
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {itemCreditCardTransactions.length} in selected range
                        </p>
                      </div>
                      <svg
                        aria-hidden="true"
                        className={`size-4 text-muted transition-transform ${
                          expandedTransactionItems[item.id] ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="m6 9 6 6 6-6"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    </button>
                  ) : null}
                  {expandedTransactionItems[item.id]
                    ? itemCreditCardTransactions.map((entry) => (
                        <div
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.07] px-4 py-3.5 sm:px-5"
                          key={`credit-card-${entry.id}`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white/80">
                              {entry.description}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              {formatDate(entry.transaction_date)} ·{" "}
                              {entry.issuer} •••• {entry.account_last_four} ·{" "}
                              <span className="capitalize">
                                {entry.transaction_type}
                              </span>
                            </p>
                            {entry.note ? <p className="mt-1 text-xs italic text-white/55">{entry.note}</p> : null}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                          <span
                            className={`whitespace-nowrap font-mono text-sm font-semibold ${
                              Number(entry.amount) < 0
                                ? "text-accent"
                                : "text-white"
                            }`}
                          >
                            {currencyFormatter.format(
                              effectiveExpenseAmount(
                                effectiveCreditCardTransactionAmount(entry),
                                item.is_shared_cost,
                              ),
                            )}
                          </span>
                          </div>
                        </div>
                      ))
                    : null}
                  {relevantEntries.map((entry) => (
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.07] px-4 py-3.5 last:border-b-0 sm:px-5"
                      key={entry.id}
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white/80">
                          {formatDate(entry.incurred_on)}
                          {entry.incurred_on > today ? (
                            <span className="ml-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-amber-100">
                              Upcoming
                            </span>
                          ) : null}
                        </p>
                        {entry.note ? (
                          <p className="mt-1 truncate text-xs text-muted">
                            {entry.note}
                            {entry.source_type === "credit_card_automation" ? (
                              <span className="ml-2 text-white/35">
                                · Automation
                              </span>
                            ) : entry.source_type ? (
                              <span className="ml-2 text-white/35">
                                · Imported PDF
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                        {item.key !== "credit-card" ? (
                          <label
                            className="mt-2 flex items-center gap-2 text-xs text-white/65"
                            title="Deduct this expense from the credit card total so it is not double counted"
                          >
                            <input
                              checked={entry.exclude_from_credit_card ?? false}
                              className="size-3.5 rounded border-white/20 bg-black/20 text-accent focus:ring-accent/40 disabled:opacity-50"
                              disabled={updatingExcludeEntryId === entry.id}
                              onChange={(event) =>
                                void toggleExcludeFromCreditCard(
                                  entry,
                                  event.target.checked,
                                )
                              }
                              type="checkbox"
                            />
                            <span>Exclude from credit card</span>
                          </label>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="whitespace-nowrap font-mono text-sm font-semibold text-white">
                            {currencyFormatter.format(
                              effectiveExpenseAmount(
                                entry.amount,
                                item.is_shared_cost,
                              ),
                            )}
                          </span>
                          {item.is_shared_cost ? (
                            <p className="mt-0.5 text-[11px] text-muted">
                              of{" "}
                              {currencyFormatter.format(Number(entry.amount))}
                            </p>
                          ) : null}
                        </div>
                        {entry.utility_detail ? (
                          <button
                            className="rounded-md px-2 py-1 text-xs text-accent/70 hover:bg-accent/10 hover:text-accent"
                            onClick={() =>
                              setExpandedEntryId((current) =>
                                current === entry.id ? null : entry.id,
                              )
                            }
                            type="button"
                          >
                            {expandedEntryId === entry.id
                              ? "Hide details"
                              : "Details"}
                          </button>
                        ) : null}
                        {confirmingDeleteId === entry.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              className="rounded-md px-2 py-1 text-xs text-white/60 hover:text-white"
                              disabled={deletingId === entry.id}
                              onClick={() => setConfirmingDeleteId(null)}
                              type="button"
                            >
                              Cancel
                            </button>
                            <button
                              className="rounded-md bg-rose-500/15 px-2 py-1 text-xs text-rose-200"
                              disabled={deletingId === entry.id}
                              onClick={() => void deleteEntry(entry.id)}
                              type="button"
                            >
                              {deletingId === entry.id ? "…" : "Delete"}
                            </button>
                          </div>
                        ) : (
                          <button
                            className="rounded-md px-2 py-1 text-xs text-rose-200/50 hover:bg-rose-500/10 hover:text-rose-200"
                            onClick={() => setConfirmingDeleteId(entry.id)}
                            type="button"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      {entry.utility_detail &&
                      expandedEntryId === entry.id ? (
                        <div className="col-span-2 mt-1 grid gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-4 sm:grid-cols-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                              Billing period
                            </p>
                            <p className="mt-1 text-xs text-white/75">
                              {formatDate(entry.utility_detail.period_start)} -{" "}
                              {formatDate(entry.utility_detail.period_end)}
                            </p>
                            <p className="mt-1 text-[11px] text-muted">
                              Invoice {entry.utility_detail.invoice_number}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                              Electric usage
                            </p>
                            <p className="mt-1 font-mono text-sm text-white">
                              {Number(
                                entry.utility_detail.electric_kwh || 0,
                              ).toLocaleString()}{" "}
                              kWh
                            </p>
                            <p className="mt-1 text-[11px] text-muted">
                              Delivery{" "}
                              {currencyFormatter.format(
                                Number(
                                  entry.utility_detail
                                    .electric_delivery_charges || 0,
                                ),
                              )}{" "}
                              · Supply{" "}
                              {currencyFormatter.format(
                                Number(
                                  entry.utility_detail
                                    .electric_supply_charges || 0,
                                ),
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                              Gas usage
                            </p>
                            <p className="mt-1 font-mono text-sm text-white">
                              {Number(
                                entry.utility_detail.gas_therms || 0,
                              ).toLocaleString()}{" "}
                              therms
                            </p>
                            <p className="mt-1 text-[11px] text-muted">
                              Delivery{" "}
                              {currencyFormatter.format(
                                Number(
                                  entry.utility_detail.gas_delivery_charges || 0,
                                ),
                              )}{" "}
                              · Supply{" "}
                              {currencyFormatter.format(
                                Number(
                                  entry.utility_detail.gas_supply_charges || 0,
                                ),
                              )}
                            </p>
                          </div>
                          <div className="sm:col-span-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-white/[0.07] pt-3 text-xs text-muted">
                            <span>
                              Electric total{" "}
                              <strong className="font-mono text-white/80">
                                {currencyFormatter.format(
                                  Number(
                                    entry.utility_detail
                                      .electric_total_charges || 0,
                                  ),
                                )}
                              </strong>
                            </span>
                            <span>
                              Gas total{" "}
                              <strong className="font-mono text-white/80">
                                {currencyFormatter.format(
                                  Number(
                                    entry.utility_detail.gas_total_charges || 0,
                                  ),
                                )}
                              </strong>
                            </span>
                            <span>
                              Actual usage cost{" "}
                              <strong className="font-mono text-accent">
                                {currencyFormatter.format(
                                  Number(
                                    entry.utility_detail
                                      .electric_total_charges || 0,
                                  ) +
                                    Number(
                                      entry.utility_detail.gas_total_charges ||
                                        0,
                                    ),
                                )}
                              </strong>
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-muted">
                  No expense data recorded in the past 12 months.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
