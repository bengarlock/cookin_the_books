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
  SuggestedRelatedTransaction,
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
  const [matchType, setMatchType] = useState<"exact" | "starts_with">("exact");
  const [matchValue, setMatchValue] = useState("");
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [relatedExpanded, setRelatedExpanded] = useState(false);
  const [categorizationExpanded, setCategorizationExpanded] = useState(false);
  const [budgetTreatmentExpanded, setBudgetTreatmentExpanded] = useState(false);
  const [relationshipSuggestions, setRelationshipSuggestions] = useState<SuggestedRelatedTransaction[]>([]);
  const [relationshipQuery, setRelationshipQuery] = useState("");
  const [relationshipResults, setRelationshipResults] = useState<CreditCardTransaction[]>([]);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipSavingId, setRelationshipSavingId] = useState<number | null>(null);
  const [categorizing, setCategorizing] = useState(false);
  const [autoCategorizingId, setAutoCategorizingId] = useState<number | null>(null);
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
    if (autoCategorizingId !== null) return;
    if (expandedTransactionId === transaction.id) {
      setExpandedTransactionId(null);
      return;
    }
    setExpandedTransactionId(transaction.id);
    setTagDraft((transaction.tags || []).map((tag) => tag.name));
    setNoteDraft(transaction.note || "");
    setCategoryDraft(
      transaction.category === "needs_review" ? "dining" : transaction.category,
    );
    setMatchType("exact");
    setMatchValue(transaction.description);
    setTagsExpanded(false);
    setNoteExpanded(false);
    setRelatedExpanded(false);
    setCategorizationExpanded(false);
    setBudgetTreatmentExpanded(false);
    setRelationshipSuggestions([]);
    setRelationshipQuery("");
    setRelationshipResults([]);
    void loadRelationshipSuggestions(transaction.id);
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

  async function autoCategorizeTransaction(transaction: ExpenseTransaction) {
    setAutoCategorizingId(transaction.id);
    setError("");
    setMessage("");
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
      setTransactions((current) => mergeExpenseTransactions(current, [compactExpenseTransaction(updated)]));
      setCategoryDraft(updated.category);
      setExpandedCategory(updated.category);
      setMessage(`Transaction categorized as ${categoryLabels[updated.category] || updated.category}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to auto categorize this transaction.");
    } finally {
      setAutoCategorizingId(null);
    }
  }

  async function saveTransaction(transaction: ExpenseTransaction, remember = false) {
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
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ match_type: matchType, match_value: matchValue, category: categoryDraft, apply_to_matching: remember, tags: tagDraft }) },
      );
      const categorized = (await categoryResponse.json().catch(() => null)) as { transactions?: CreditCardTransaction[]; updated_count?: number; message?: string } | null;
      if (!categoryResponse.ok || !categorized?.transactions) throw new Error(categorized?.message || "Unable to save the category.");

      if (remember) await refreshTransactions();
      else setTransactions((current) => mergeExpenseTransactions(current, categorized.transactions!.map(compactExpenseTransaction)));
      setTagLibrary((current) => {
        const tags = new Map(current.map((tag) => [tag.name.toLocaleLowerCase(), tag]));
        tagged.tags.forEach((tag) => tags.set(tag.name.toLocaleLowerCase(), tag));
        return Array.from(tags.values());
      });
      setExpandedTransactionId(null);
      setMessage(remember ? `Updated ${categorized.updated_count || 0} matching transactions.` : "Transaction updated.");
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

  async function loadRelationshipSuggestions(transactionId: number) {
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/credit-card-transactions/${transactionId}/relationship-suggestions`, { cache: "no-store" });
      const result = (await response.json().catch(() => null)) as SuggestedRelatedTransaction[] | { message?: string } | null;
      if (!response.ok || !Array.isArray(result)) throw new Error("Unable to load relationship suggestions.");
      setRelationshipSuggestions(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load relationship suggestions.");
    }
  }

  async function searchRelatedTransactions(transactionId: number) {
    const query = relationshipQuery.trim();
    if (!query) return;
    setRelationshipLoading(true);
    try {
      const params = new URLSearchParams({ include_unbudgeted: "true", search: query, exclude_id: String(transactionId), limit: "10" });
      const response = await fetch(`${APP_BASE_PATH}/api/credit-card-transactions?${params}`, { cache: "no-store" });
      const result = (await response.json().catch(() => null)) as CreditCardTransaction[] | { message?: string } | null;
      if (!response.ok || !Array.isArray(result)) throw new Error("Unable to search transactions.");
      setRelationshipResults(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to search transactions.");
    } finally { setRelationshipLoading(false); }
  }

  async function updateRelationship(transactionId: number, relatedTransactionId: number, method: "POST" | "DELETE") {
    setRelationshipSavingId(relatedTransactionId);
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/credit-card-transactions/${transactionId}/relationships`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ related_transaction_id: relatedTransactionId }) });
      const result = (await response.json().catch(() => null)) as CreditCardTransaction | { message?: string } | null;
      if (!response.ok || !result || !("id" in result)) throw new Error(result && "message" in result ? result.message : "Unable to update this relationship.");
      setTransactions((current) => mergeExpenseTransactions(current, [compactExpenseTransaction(result)]));
      setRelationshipResults((current) => current.filter((item) => item.id !== relatedTransactionId));
      setRelationshipSuggestions((current) => current.filter((item) => item.id !== relatedTransactionId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this relationship.");
    } finally { setRelationshipSavingId(null); }
  }

  async function updateBudgetTreatment(transaction: ExpenseTransaction, patch: Partial<Pick<ExpenseTransaction, "split" | "include">>) {
    setSavingId(transaction.id);
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/update-budget-flags?include_unbudgeted=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const result = (await response.json().catch(() => null)) as CreditCardTransaction | { message?: string } | null;
      if (!response.ok || !result || !("id" in result)) throw new Error(result && "message" in result ? result.message : "Unable to update budget treatment.");
      setTransactions((current) => mergeExpenseTransactions(current, [compactExpenseTransaction(result)]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update budget treatment.");
    } finally { setSavingId(null); }
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
            <button className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50" disabled={categorizing || autoCategorizingId !== null} onClick={() => void categorizeExpenses()} type="button">{categorizing ? "Categorizing…" : "Categorize transactions"}</button>
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
              {expanded ? <div className="divide-y divide-white/[0.06] border-t border-white/[0.07] bg-black/10">{rows.map((transaction) => <TransactionRow autoCategorizing={autoCategorizingId === transaction.id} autoCategorizeDisabled={categorizing || savingId !== null || autoCategorizingId !== null} onAutoCategorize={() => void autoCategorizeTransaction(transaction)} availableTagNames={availableTagNames} budgetTreatmentExpanded={budgetTreatmentExpanded} categorizationExpanded={categorizationExpanded} categoryDraft={categoryDraft} categoryOptions={categoryOptions} key={transaction.id} matchType={matchType} matchValue={matchValue} noteDraft={noteDraft} noteExpanded={noteExpanded} onBudgetTreatmentToggle={() => setBudgetTreatmentExpanded((value) => !value)} onCategorizationToggle={() => setCategorizationExpanded((value) => !value)} onCategoryChange={setCategoryDraft} onMatchTypeChange={setMatchType} onMatchValueChange={setMatchValue} onNoteChange={setNoteDraft} onNoteToggle={() => setNoteExpanded((value) => !value)} onRelatedToggle={() => setRelatedExpanded((value) => !value)} onSave={(remember) => void saveTransaction(transaction, remember)} onTagToggle={toggleTag} onTagsToggle={() => setTagsExpanded((value) => !value)} onToggle={() => openTransaction(transaction)} onUpdateBudgetTreatment={(patch) => void updateBudgetTreatment(transaction, patch)} relatedExpanded={relatedExpanded} relationshipLoading={relationshipLoading} relationshipResults={relationshipResults} relationshipSavingId={relationshipSavingId} relationshipSuggestions={relationshipSuggestions} relationshipQuery={relationshipQuery} saving={savingId === transaction.id || autoCategorizingId === transaction.id} selected={expandedTransactionId === transaction.id} setRelationshipQuery={setRelationshipQuery} onSearchRelated={() => void searchRelatedTransactions(transaction.id)} onUpdateRelationship={(relatedId, method) => void updateRelationship(transaction.id, relatedId, method)} tagDraft={tagDraft} tagsExpanded={tagsExpanded} transaction={transaction} />)}</div> : null}
            </div>;
          })}
        </div> : <p className="mt-5 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted">{normalizedSearch ? `No transactions match “${search.trim()}”.` : "No categorized expenses were found in this date range."}</p>}
      </section>
    </div>
  );
}

function TransactionRow(props: TransactionRowProps) {
  const { transaction } = props;
  const [hasReceiptLineItems, setHasReceiptLineItems] = useState(false);
  const controlClass = (active: boolean, color: string) => `rounded-lg border px-3 py-2 text-xs font-semibold transition ${active ? color : "border-white/10 text-white/65 hover:border-accent/25 hover:text-accent"}`;
  return <div className={`px-4 py-3 ${props.selected ? "bg-sky-400/[0.12]" : ""}`}>
    <button className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 text-left" onClick={props.onToggle} type="button"><span className="min-w-0"><span className="block truncate text-sm font-medium text-white">{transaction.description}</span><span className="mt-1 block text-xs text-muted">{formatDate(transaction.transaction_date)} · {transaction.issuer} •••• {transaction.account_last_four}</span><span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{transaction.category}</span>{transaction.tags.length ? <span className="mt-1.5 flex flex-wrap gap-1">{transaction.tags.map((tag) => <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2 py-0.5 text-[10px] text-sky-100" key={tag.id}>{tag.name}</span>)}</span> : null}</span><span className="flex items-center gap-3 font-mono text-sm font-semibold text-white">{currencyFormatter.format(effectiveCategorizedExpenseAmount(transaction))}<span className="grid size-7 place-items-center rounded-full border border-white/10 text-base font-medium text-white/55">{props.selected ? "−" : "+"}</span></span></button>
    <MatchedOrderDetails onLineItemsAvailable={setHasReceiptLineItems} transaction={transaction} />
    {props.selected ? <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/10 p-3">
      <div className="flex flex-wrap items-center gap-2"><button className={controlClass(props.tagsExpanded, "border-sky-300/30 bg-sky-400/10 text-sky-100")} onClick={props.onTagsToggle} type="button">Tags</button><button className={controlClass(props.noteExpanded, "border-accent/30 bg-accent/10 text-accent")} onClick={props.onNoteToggle} type="button">Note</button><button className={controlClass(props.relatedExpanded, "border-gold/30 bg-gold/10 text-gold")} onClick={props.onRelatedToggle} type="button">Related transactions</button><button className={controlClass(props.categorizationExpanded, "border-violet-300/30 bg-violet-400/10 text-violet-100")} onClick={props.onCategorizationToggle} type="button">Categorize</button>
        {hasReceiptLineItems ? <button
          className="rounded-lg border border-violet-300/30 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:border-violet-300/50 hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={props.autoCategorizeDisabled}
          onClick={props.onAutoCategorize}
          title="Uses the matched receipt line items to choose one category."
          type="button"
        >{props.autoCategorizing ? "Auto categorizing…" : "Auto categorize"}</button> : null}
        <button className={controlClass(props.budgetTreatmentExpanded, "border-accent/30 bg-accent/10 text-accent")} onClick={props.onBudgetTreatmentToggle} type="button">Budget treatment</button></div>
      {props.tagsExpanded ? <div className="mt-3 border-t border-white/[0.07] pt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Tags</p><div className="mt-2 flex flex-wrap gap-2">{props.availableTagNames.map((tag) => <button className={`rounded-full border px-2.5 py-1 text-[11px] ${props.tagDraft.includes(tag) ? "border-sky-300/30 bg-sky-400/10 text-sky-100" : "border-white/10 text-white/60"}`} key={tag} onClick={() => props.onTagToggle(tag)} type="button">{props.tagDraft.includes(tag) ? "✓ " : "+ "}{tag}</button>)}</div></div> : null}
      {props.noteExpanded ? <label className="mt-3 block border-t border-white/[0.07] pt-3"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Transaction note</span><textarea className="mt-2 min-h-20 w-full resize-y rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-xs text-white outline-none focus:border-accent/50" maxLength={2000} onChange={(event) => props.onNoteChange(event.target.value)} placeholder="Add context about this transaction" value={props.noteDraft} /></label> : null}
      {props.categorizationExpanded ? <div className="mt-3 grid items-center gap-2 border-t border-white/[0.07] pt-3 sm:grid-cols-[auto_minmax(12rem,1fr)_auto_minmax(10rem,auto)]"><select className="h-9 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white" onChange={(event) => props.onMatchTypeChange(event.target.value as "exact" | "starts_with")} value={props.matchType}><option value="exact">Equals</option><option value="starts_with">Starts with</option></select><input className="h-9 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white" onChange={(event) => props.onMatchValueChange(event.target.value)} value={props.matchValue} /><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Set category</span><select className="h-9 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white" onChange={(event) => props.onCategoryChange(event.target.value)} value={props.categoryDraft}>{props.categoryOptions.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select></div> : null}
      {props.budgetTreatmentExpanded ? <div className="mt-3 border-t border-white/[0.07] pt-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Budget treatment</p><div className="flex gap-1.5"><button aria-pressed={transaction.split} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${transaction.split ? "border-violet-300/30 bg-violet-400/15 text-violet-100" : "border-white/10 text-white/45"}`} disabled={props.saving} onClick={() => props.onUpdateBudgetTreatment({ split: !transaction.split })} type="button">Split</button><button aria-pressed={transaction.include} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${transaction.include ? "border-accent/25 bg-accent/10 text-accent" : "border-rose-300/20 bg-rose-400/10 text-rose-100"}`} disabled={props.saving} onClick={() => props.onUpdateBudgetTreatment({ include: !transaction.include })} type="button">{transaction.include ? "Included" : "Excluded"}</button></div></div> : null}
      {props.relatedExpanded ? <div className="mt-3 border-t border-white/[0.07] pt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Related transactions</p>{props.relationshipSuggestions.map((item) => <RelationshipRow item={item} key={item.id} label="Link" onClick={() => props.onUpdateRelationship(item.id, "POST")} saving={props.relationshipSavingId === item.id} />)}<div className="mt-3 flex gap-2"><input className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white" onChange={(event) => props.setRelationshipQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); props.onSearchRelated(); } }} placeholder="Search merchant, amount, account, or date" value={props.relationshipQuery} /><button className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70" disabled={props.relationshipLoading || !props.relationshipQuery.trim()} onClick={props.onSearchRelated} type="button">{props.relationshipLoading ? "Searching…" : "Search"}</button></div>{props.relationshipResults.map((item) => <RelationshipRow item={item} key={item.id} label="Link" onClick={() => props.onUpdateRelationship(item.id, "POST")} saving={props.relationshipSavingId === item.id} />)}</div> : null}
      <div className="mt-3 flex flex-wrap gap-2"><button className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent" disabled={props.saving} onClick={() => props.onSave(false)} type="button">{props.saving ? "Saving…" : "Save this transaction"}</button><button className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-muted" disabled={props.saving} onClick={() => props.onSave(true)} type="button">Save &amp; remember</button><button className="px-2 py-2 text-xs text-muted" onClick={props.onToggle} type="button">Cancel</button></div><p className="mt-2 text-[11px] text-muted">Save this transaction changes only the selected row. Save &amp; remember also applies this category and these tags to matching descriptions and future imports.</p>
    </div> : null}
  </div>;
}

function RelationshipRow({ item, label, onClick, saving }: { item: CreditCardTransaction; label: string; onClick: () => void; saving: boolean }) { return <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-gold/20 bg-gold/[0.05] px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-medium text-white">{item.description}</p><p className="mt-0.5 text-[11px] text-muted">{formatDate(item.transaction_date)} · {item.issuer} •••• {item.account_last_four} · {currencyFormatter.format(Number(item.amount))}</p></div><button className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent" disabled={saving} onClick={onClick} type="button">{label}</button></div>; }

type TransactionRowProps = { autoCategorizing: boolean; autoCategorizeDisabled: boolean; onAutoCategorize: () => void; transaction: ExpenseTransaction; selected: boolean; onToggle: () => void; categoryOptions: ExpenseCategory[]; categoryDraft: string; onCategoryChange: (value: string) => void; noteDraft: string; onNoteChange: (value: string) => void; matchType: "exact" | "starts_with"; onMatchTypeChange: (value: "exact" | "starts_with") => void; matchValue: string; onMatchValueChange: (value: string) => void; onSave: (remember: boolean) => void; saving: boolean; tagDraft: string[]; onTagToggle: (name: string) => void; availableTagNames: string[]; tagsExpanded: boolean; onTagsToggle: () => void; noteExpanded: boolean; onNoteToggle: () => void; relatedExpanded: boolean; onRelatedToggle: () => void; categorizationExpanded: boolean; onCategorizationToggle: () => void; budgetTreatmentExpanded: boolean; onBudgetTreatmentToggle: () => void; onUpdateBudgetTreatment: (patch: Partial<Pick<ExpenseTransaction, "split" | "include">>) => void; relationshipSuggestions: SuggestedRelatedTransaction[]; relationshipResults: CreditCardTransaction[]; relationshipQuery: string; setRelationshipQuery: (value: string) => void; relationshipLoading: boolean; relationshipSavingId: number | null; onSearchRelated: () => void; onUpdateRelationship: (id: number, method: "POST" | "DELETE") => void; };
