"use client";

import { FormEvent, useState } from "react";

import type { BudgetItem } from "@/lib/budget-item-types";
import { APP_BASE_PATH } from "@/lib/config";
import { creditCardExpenditureAverages } from "@/lib/credit-card-averages";
import type { CreditCardTransaction } from "@/lib/credit-card-transaction-types";
import {
  defaultExpenseDateRange,
  type ExpenseDateRange,
  formatExpenseDateRange,
} from "@/lib/expense-date-range";
import type { ExpenseEntry } from "@/lib/expense-entry-types";
import { validatePdfImportFiles } from "@/lib/pdf-import";
import { DateRangePicker } from "@/components/date-range-picker";

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
  budgetItems,
  initialCreditCardTransactions,
  initialEntries,
}: {
  budgetItems: BudgetItem[];
  initialCreditCardTransactions: CreditCardTransaction[];
  initialEntries: ExpenseEntry[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [creditCardTransactions, setCreditCardTransactions] = useState(
    initialCreditCardTransactions,
  );
  const [openItemId, setOpenItemId] = useState<number | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [importingItemId, setImportingItemId] = useState<number | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [error, setError] = useState("");
  const [entryForm, setEntryForm] = useState({
    incurredOn: todayString(),
    amount: "",
    note: "",
  });
  const [dateRanges, setDateRanges] = useState<Record<number, ExpenseDateRange>>(
    () =>
      Object.fromEntries(
        budgetItems.map((item) => [item.id, defaultExpenseDateRange()]),
      ),
  );
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

  async function importExpensePdfs(item: BudgetItem, files: File[]) {
    const validationError = validatePdfImportFiles(files);
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
      const response = await fetch(
        `${APP_BASE_PATH}/api/budget-items/${item.id}/import-${importKind}-pdf`,
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
              : `Unable to import the ${item.label.toLowerCase()} PDFs.`,
        );
      }
      if (result.created.length) {
        if (item.key === "credit-card") {
          setCreditCardTransactions((current) => [
            ...(result.created as CreditCardTransaction[]),
            ...current,
          ]);
        } else {
          setEntries((current) => [
            ...(result.created as ExpenseEntry[]),
            ...current,
          ]);
        }
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
      const errorText = result.error_count
        ? ` ${result.error_count} ${
            result.error_count === 1 ? "file" : "files"
          } failed: ${result.errors
            .map((item) => `${item.file} (${item.detail})`)
            .join("; ")}`
        : "";
      setImportMessage(`${createdText}${duplicateText}${errorText}`);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : `Unable to import the ${item.label.toLowerCase()} PDFs.`,
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
          const spendingTransactions = itemCreditCardTransactions.filter(
            (entry) =>
              entry.transaction_date <= today &&
              ["purchase", "fee", "interest"].includes(
                entry.transaction_type,
              ),
          );
          const creditCardAverages = creditCardExpenditureAverages(
            itemCreditCardTransactions,
            dateRange.start,
            dateRange.end,
          );
          const historyEntryCount =
            historicalEntries.length + itemCreditCardTransactions.length;
          const annualTotal = historicalEntries.reduce(
            (total, entry) => total + Number(entry.amount),
            0,
          ) +
            spendingTransactions.reduce(
              (total, entry) => total + Number(entry.amount),
              0,
            );
          const averageEntryCount =
            historicalEntries.length + spendingTransactions.length;
          const average =
            averageEntryCount > 0
              ? annualTotal / averageEntryCount
              : 0;

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
                  {["housing", "power", "credit-card"].includes(item.key) ? (
                    <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/65 transition hover:border-accent/20 hover:text-accent">
                      {importingItemId === item.id
                        ? "Importing…"
                        : "Import PDFs"}
                      <input
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        disabled={importingItemId === item.id}
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          if (files.length) {
                            void importExpensePdfs(item, files);
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
                className={`grid border-b border-white/[0.07] bg-black/10 ${
                  item.key === "credit-card"
                    ? "grid-cols-2 lg:grid-cols-4"
                    : "grid-cols-2"
                }`}
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
                        : annualTotal,
                    )}
                  </p>
                </div>
                {item.key === "credit-card" ? (
                  <>
                    <div className="px-4 py-3 sm:px-5 lg:border-r lg:border-white/[0.07]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                        Daily average
                      </p>
                      <p className="mt-1 font-mono text-lg font-semibold text-white">
                        {currencyFormatter.format(creditCardAverages.daily)}
                      </p>
                    </div>
                    <div className="border-r border-t border-white/[0.07] px-4 py-3 sm:px-5 lg:border-t-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                        Weekly average
                      </p>
                      <p className="mt-1 font-mono text-lg font-semibold text-white">
                        {currencyFormatter.format(creditCardAverages.weekly)}
                      </p>
                    </div>
                    <div className="border-t border-white/[0.07] px-4 py-3 sm:px-5 lg:border-t-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                        Monthly average
                      </p>
                      <p className="mt-1 font-mono text-lg font-semibold text-white">
                        {currencyFormatter.format(creditCardAverages.monthly)}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="px-4 py-3 sm:px-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Average entry
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold text-white">
                      {currencyFormatter.format(average)}
                    </p>
                  </div>
                )}
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

              {relevantEntries.length || itemCreditCardTransactions.length ? (
                <div>
                  {itemCreditCardTransactions.map((entry) => (
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.07] px-4 py-3.5 sm:px-5"
                      key={`credit-card-${entry.id}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white/80">
                          {entry.description}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {formatDate(entry.transaction_date)} · {entry.issuer}{" "}
                          •••• {entry.account_last_four} ·{" "}
                          <span className="capitalize">
                            {entry.transaction_type}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`whitespace-nowrap font-mono text-sm font-semibold ${
                          Number(entry.amount) < 0
                            ? "text-accent"
                            : "text-white"
                        }`}
                      >
                        {currencyFormatter.format(Number(entry.amount))}
                      </span>
                    </div>
                  ))}
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
