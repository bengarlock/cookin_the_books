"use client";

import { useMemo, useState } from "react";

import { MatchedOrderDetails } from "@/components/matched-order-details";
import { APP_BASE_PATH } from "@/lib/config";
import {
  effectiveCategorizedExpenseAmount,
  isCategorizedExpense,
} from "@/lib/categorized-expense-averages";
import type {
  CreditCardTransaction,
  ExpenseTag,
  ExpenseTransaction,
} from "@/lib/credit-card-transaction-types";
import type { ExpenseCategory } from "@/lib/expense-category-types";
import type { ExpenseDateRange } from "@/lib/expense-date-range";
import {
  compactExpenseTransaction,
  mergeExpenseTransactions,
} from "@/lib/expense-transaction-record";
import {
  categoryLabelMap,
  sortedCategoryOptions,
} from "@/lib/transaction-categories";

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
  initialCategories,
  initialRange,
  initialTags,
  initialTransactions,
}: {
  initialCategories: ExpenseCategory[];
  initialRange: ExpenseDateRange;
  initialTags: ExpenseTag[];
  initialTransactions: ExpenseTransaction[];
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [tagLibrary, setTagLibrary] = useState(initialTags);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedTransactionId, setExpandedTransactionId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("dining");
  const [applyToMatching, setApplyToMatching] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const categoryLabels = categoryLabelMap(initialCategories);
  const categoryOptions = sortedCategoryOptions(initialCategories);
  const today = todayString();
  const normalizedSearch = search.trim().toLocaleLowerCase();

  const categorizedTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          isCategorizedExpense(transaction) &&
          transaction.transaction_date >= initialRange.start &&
          transaction.transaction_date <= initialRange.end &&
          transaction.transaction_date <= today,
      ),
    [initialRange.end, initialRange.start, today, transactions],
  );
  const filteredTransactions = useMemo(
    () =>
      normalizedSearch
        ? categorizedTransactions.filter((transaction) =>
            [
              transaction.description,
              transaction.issuer,
              transaction.account_last_four,
              transaction.transaction_date,
              transaction.amount,
              transaction.note,
              transaction.category,
              categoryLabels[transaction.category],
              ...(transaction.tags || []).map((tag) => tag.name),
            ].some((value) =>
              String(value || "").toLocaleLowerCase().includes(normalizedSearch),
            ),
          )
        : categorizedTransactions,
    [categorizedTransactions, categoryLabels, normalizedSearch],
  );
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of categorizedTransactions) {
      totals.set(
        transaction.category,
        (totals.get(transaction.category) || 0) +
          effectiveCategorizedExpenseAmount(transaction),
      );
    }
    return Array.from(totals.entries()).sort((left, right) => right[1] - left[1]);
  }, [categorizedTransactions]);
  const total = categoryTotals.reduce((sum, [, amount]) => sum + amount, 0);
  const availableTagNames = tagLibrary
    .map((tag) => tag.name)
    .sort((left, right) => left.localeCompare(right));

  function openTransaction(transaction: ExpenseTransaction) {
    setExpandedTransactionId((current) =>
      current === transaction.id ? null : transaction.id,
    );
    setTagDraft((transaction.tags || []).map((tag) => tag.name));
    setNoteDraft(transaction.note || "");
    setCategoryDraft(
      transaction.category === "needs_review" ? "dining" : transaction.category,
    );
    setApplyToMatching(false);
  }

  async function refreshTransactions() {
    const response = await fetch(
      `${APP_BASE_PATH}/api/credit-card-transactions?summary=expenses&start=${initialRange.start}&end=${initialRange.end}`,
      { cache: "no-store" },
    );
    const result = (await response.json().catch(() => null)) as ExpenseTransaction[] | null;
    if (!response.ok || !Array.isArray(result)) {
      throw new Error("The transactions were updated, but the expense list could not refresh.");
    }
    setTransactions(result);
  }

  async function categorizeExpenses() {
    setCategorizing(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions?include_unbudgeted=true`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      const result = (await response.json().catch(() => null)) as
        | { categorized_count?: number; message?: string }
        | null;
      if (!response.ok) throw new Error(result?.message || "Unable to categorize transactions.");
      await refreshTransactions();
      setMessage(`Categorized ${result?.categorized_count || 0} transactions.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to categorize transactions.");
    } finally {
      setCategorizing(false);
    }
  }

  async function saveTransaction(transaction: ExpenseTransaction) {
    if (!categoryDraft) return;
    setSavingId(transaction.id);
    setError("");
    try {
      const noteResponse = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/update-note?include_unbudgeted=true`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: noteDraft }) },
      );
      const noted = (await noteResponse.json().catch(() => null)) as CreditCardTransaction | { message?: string } | null;
      if (!noteResponse.ok || !noted || !("id" in noted)) throw new Error(noted && "message" in noted ? noted.message : "Unable to save the transaction note.");

      const tagResponse = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/update-tags?include_unbudgeted=true`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: tagDraft }) },
      );
      const tagged = (await tagResponse.json().catch(() => null)) as CreditCardTransaction | { message?: string } | null;
      if (!tagResponse.ok || !tagged || !("id" in tagged)) throw new Error(tagged && "message" in tagged ? tagged.message : "Unable to save tags.");

      const categoryResponse = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/correct-category?include_unbudgeted=true`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ match_type: "exact", match_value: transaction.description, category: categoryDraft, apply_to_matching: applyToMatching }) },
      );
      const categorized = (await categoryResponse.json().catch(() => null)) as { transactions?: CreditCardTransaction[]; updated_count?: number; message?: string } | null;
      if (!categoryResponse.ok || !categorized?.transactions) throw new Error(categorized?.message || "Unable to save the category.");

      if (applyToMatching) await refreshTransactions();
      else setTransactions((current) => mergeExpenseTransactions(current, categorized.transactions!.map(compactExpenseTransaction)));
      setTagLibrary((current) => {
        const tags = new Map(current.map((tag) => [tag.name.toLocaleLowerCase(), tag]));
        tagged.tags.forEach((tag) => tags.set(tag.name.toLocaleLowerCase(), tag));
        return Array.from(tags.values());
      });
      setExpandedTransactionId(null);
      setMessage(applyToMatching ? `Updated ${categorized.updated_count || 0} matching transactions.` : "Transaction updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the transaction.");
    } finally {
      setSavingId(null);
    }
  }

  function toggleTag(name: string) {
    setTagDraft((current) =>
      current.some((tag) => tag.toLocaleLowerCase() === name.toLocaleLowerCase())
        ? current.filter((tag) => tag.toLocaleLowerCase() !== name.toLocaleLowerCase())
        : [...current, name],
    );
  }

  return (
    <div className="mt-8">
      {error ? <p className="mb-5 rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100" role="alert">{error}</p> : null}
      {message ? <p className="mb-5 rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent" role="status">{message}</p> : null}
      <section className="surface rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Spending by category</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Expenses from categorized transactions</h2>
            <p className="mt-1 text-sm text-muted">{currencyFormatter.format(total)} across {categoryTotals.length} categories</p>
            <p className="mt-1 text-xs text-white/45">Includes posted purchases, fees, and interest from checking and credit-card accounts. Categories set by you or automatically by the system are included.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-56 flex-1 sm:flex-none">
              <span className="sr-only">Search transactions</span>
              <input className="h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-accent/40 sm:w-64" onChange={(event) => { setSearch(event.target.value); setExpandedCategory(null); }} placeholder="Search transactions" type="search" value={search} />
            </label>
            <button className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50" disabled={categorizing} onClick={() => void categorizeExpenses()} type="button">{categorizing ? "Categorizing…" : "Categorize transactions"}</button>
          </div>
        </div>
        {categoryTotals.length ? <div className="mt-5 space-y-2">
          {categoryTotals.map(([category, amount]) => {
            const expanded = expandedCategory === category;
            const rows = filteredTransactions.filter((transaction) => transaction.category === category).sort((left, right) => right.transaction_date.localeCompare(left.transaction_date) || right.id - left.id);
            return <div className="overflow-hidden rounded-xl border border-white/[0.07]" key={category}>
              <button aria-expanded={expanded} className="w-full px-3 py-3 text-left transition hover:bg-white/[0.035]" onClick={() => setExpandedCategory(expanded ? null : category)} type="button">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-white/75"><span aria-hidden="true" className={`text-accent transition ${expanded ? "rotate-90" : ""}`}>›</span>{categoryLabels[category] || category}<span className="text-muted">{rows.length}</span></span><span className="font-mono text-white">{currencyFormatter.format(amount)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-accent" style={{ width: `${total ? Math.max(2, amount / total * 100) : 0}%` }} /></div>
              </button>
              {expanded ? <div className="divide-y divide-white/[0.06] border-t border-white/[0.07] bg-black/10">{rows.map((transaction) => <TransactionRow categoryDraft={categoryDraft} categoryOptions={categoryOptions} key={transaction.id} noteDraft={noteDraft} onCategoryChange={setCategoryDraft} onNoteChange={setNoteDraft} onSave={() => void saveTransaction(transaction)} onTagToggle={toggleTag} onToggle={() => openTransaction(transaction)} onApplyToMatchingChange={setApplyToMatching} saving={savingId === transaction.id} selected={expandedTransactionId === transaction.id} tagDraft={tagDraft} transaction={transaction} applyToMatching={applyToMatching} availableTagNames={availableTagNames} />)}</div> : null}
            </div>;
          })}
        </div> : <p className="mt-5 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted">{normalizedSearch ? `No transactions match “${search.trim()}”.` : "No categorized expenses were found in this date range."}</p>}
      </section>
    </div>
  );
}

function TransactionRow({ transaction, selected, onToggle, categoryOptions, categoryDraft, onCategoryChange, noteDraft, onNoteChange, onSave, saving, tagDraft, onTagToggle, availableTagNames, applyToMatching, onApplyToMatchingChange }: { transaction: ExpenseTransaction; selected: boolean; onToggle: () => void; categoryOptions: ExpenseCategory[]; categoryDraft: string; onCategoryChange: (value: string) => void; noteDraft: string; onNoteChange: (value: string) => void; onSave: () => void; saving: boolean; tagDraft: string[]; onTagToggle: (name: string) => void; availableTagNames: string[]; applyToMatching: boolean; onApplyToMatchingChange: (value: boolean) => void }) {
  return <div className="px-4 py-3">
    <button className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 text-left" onClick={onToggle} type="button"><span className="min-w-0"><span className="block truncate text-sm font-medium text-white">{transaction.description}</span><span className="mt-1 block text-xs text-muted">{formatDate(transaction.transaction_date)} · {transaction.issuer} •••• {transaction.account_last_four}</span></span><span className="font-mono text-sm font-semibold text-white">{currencyFormatter.format(effectiveCategorizedExpenseAmount(transaction))}</span></button>
    <MatchedOrderDetails transaction={transaction} />
    {selected ? <div className="mt-3 border-t border-white/[0.07] pt-3">
      <div className="grid gap-3 sm:grid-cols-2"><label><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Category</span><select className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50" onChange={(event) => onCategoryChange(event.target.value)} value={categoryDraft}>{categoryOptions.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select></label><label><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Note</span><input className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50" onChange={(event) => onNoteChange(event.target.value)} placeholder="Add a note" value={noteDraft} /></label></div>
      <div className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Tags</p><div className="mt-2 flex flex-wrap gap-2">{availableTagNames.map((tag) => <button className={`rounded-full border px-2.5 py-1 text-[11px] ${tagDraft.includes(tag) ? "border-sky-300/30 bg-sky-400/10 text-sky-100" : "border-white/10 text-white/60"}`} key={tag} onClick={() => onTagToggle(tag)} type="button">{tagDraft.includes(tag) ? "✓ " : "+ "}{tag}</button>)}</div></div>
      <label className="mt-3 flex items-center gap-2 text-xs text-white/65"><input checked={applyToMatching} className="size-3.5 rounded border-white/20 bg-black/20 text-accent" onChange={(event) => onApplyToMatchingChange(event.target.checked)} type="checkbox" />Apply category to matching transactions</label>
      <div className="mt-3 flex gap-2"><button className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50" disabled={saving} onClick={onSave} type="button">{saving ? "Saving…" : "Save transaction"}</button><button className="px-2 py-2 text-xs text-muted hover:text-white" onClick={onToggle} type="button">Cancel</button></div>
    </div> : null}
  </div>;
}
