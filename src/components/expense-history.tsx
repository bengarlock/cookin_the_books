"use client";

import { FormEvent, useState } from "react";

import type { BudgetItem } from "@/lib/budget-item-types";
import { APP_BASE_PATH } from "@/lib/config";
import type { ExpenseEntry } from "@/lib/expense-entry-types";

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

function oneYearAgoString() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function ExpenseHistory({
  budgetItems,
  initialEntries,
}: {
  budgetItems: BudgetItem[];
  initialEntries: ExpenseEntry[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [openItemId, setOpenItemId] = useState<number | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [importingItemId, setImportingItemId] = useState<number | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [error, setError] = useState("");
  const [entryForm, setEntryForm] = useState({
    incurredOn: todayString(),
    amount: "",
    note: "",
  });
  const cutoff = oneYearAgoString();
  const today = todayString();

  async function addEntry(
    event: FormEvent<HTMLFormElement>,
    budgetItemId: number,
  ) {
    event.preventDefault();
    const amount = Number(entryForm.amount);
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
      setEntryForm({ incurredOn: todayString(), amount: "", note: "" });
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

  async function importHousingPdf(itemId: number, file: File) {
    setImportingItemId(itemId);
    setError("");
    setImportMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `${APP_BASE_PATH}/api/budget-items/${itemId}/import-housing-pdf`,
        {
          method: "POST",
          body: formData,
        },
      );
      const result = (await response.json().catch(() => null)) as
        | {
            created: ExpenseEntry[];
            created_count: number;
            duplicate_count: number;
          }
        | { detail?: string; message?: string }
        | null;
      if (!response.ok || !result || !("created" in result)) {
        throw new Error(
          result && "detail" in result && result.detail
            ? result.detail
            : result && "message" in result && result.message
              ? result.message
              : "Unable to import the housing PDF.",
        );
      }
      if (result.created.length) {
        setEntries((current) => [...result.created, ...current]);
      }
      const createdText =
        result.created_count === 1
          ? "Imported 1 expense."
          : `Imported ${result.created_count} expenses.`;
      const duplicateText = result.duplicate_count
        ? ` ${result.duplicate_count} duplicate ${
            result.duplicate_count === 1 ? "was" : "were"
          } skipped.`
        : "";
      setImportMessage(`${createdText}${duplicateText}`);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to import the housing PDF.",
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

      <div className="grid gap-5 xl:grid-cols-2">
        {budgetItems.map((item) => {
          const relevantEntries = entries
            .filter(
              (entry) =>
                entry.budget_item === item.id && entry.incurred_on >= cutoff,
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
          const annualTotal = historicalEntries.reduce(
            (total, entry) => total + Number(entry.amount),
            0,
          );
          const average =
            historicalEntries.length > 0
              ? annualTotal / historicalEntries.length
              : 0;

          return (
            <article
              className="surface overflow-hidden rounded-2xl"
              key={item.id}
            >
              <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    {item.label}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    Past 12 months · {historicalEntries.length}{" "}
                    {historicalEntries.length === 1 ? "entry" : "entries"}
                    {upcomingEntries.length
                      ? ` · ${upcomingEntries.length} upcoming`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {item.key === "housing" ? (
                    <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/65 transition hover:border-accent/20 hover:text-accent">
                      {importingItemId === item.id
                        ? "Importing…"
                        : "Import PDF"}
                      <input
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        disabled={importingItemId === item.id}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void importHousingPdf(item.id, file);
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

              <div className="grid grid-cols-2 border-b border-white/[0.07] bg-black/10">
                <div className="border-r border-white/[0.07] px-4 py-3 sm:px-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    12-month total
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-accent">
                    {currencyFormatter.format(annualTotal)}
                  </p>
                </div>
                <div className="px-4 py-3 sm:px-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Average entry
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-white">
                    {currencyFormatter.format(average)}
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
                      onChange={(event) =>
                        setEntryForm((current) => ({
                          ...current,
                          amount: event.target.value,
                        }))
                      }
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
                  <button
                    className="h-10 rounded-lg bg-accent-strong px-4 text-sm font-semibold text-[#03120c] transition hover:bg-accent disabled:opacity-50 sm:col-span-2"
                    disabled={savingItemId === item.id}
                    type="submit"
                  >
                    {savingItemId === item.id ? "Saving…" : "Save entry"}
                  </button>
                </form>
              ) : null}

              {relevantEntries.length ? (
                <div>
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
                            {entry.source_type ? (
                              <span className="ml-2 text-white/35">
                                · Imported PDF
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="whitespace-nowrap font-mono text-sm font-semibold text-white">
                          {currencyFormatter.format(Number(entry.amount))}
                        </span>
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
