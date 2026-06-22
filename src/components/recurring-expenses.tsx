"use client";

import { FormEvent, useState } from "react";

import type { BudgetItem } from "@/lib/budget-item-types";
import {
  amountForBudgetPeriod,
  budgetPeriods,
  monthlyAmountFromBudgetPeriod,
  type BudgetPeriod,
} from "@/lib/budget-periods";
import { APP_BASE_PATH } from "@/lib/config";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function RecurringExpenses({
  initialItems,
}: {
  initialItems: BudgetItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    label: "",
    monthlyAmount: "",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function cellKey(itemId: number, period: BudgetPeriod) {
    return `${itemId}:${period}`;
  }

  function beginAmountEdit(item: BudgetItem, period: BudgetPeriod) {
    setEditingCell(cellKey(item.id, period));
    setInputValue(
      amountForBudgetPeriod(Number(item.monthly_amount), period).toFixed(2),
    );
    setError("");
  }

  function updateAmount(itemId: number, period: BudgetPeriod, value: string) {
    setInputValue(value);
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;

    const monthlyAmount = monthlyAmountFromBudgetPeriod(amount, period);
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, monthly_amount: monthlyAmount.toFixed(6) }
          : item,
      ),
    );
  }

  async function patchItem(itemId: number, changes: Partial<BudgetItem>) {
    setSavingId(itemId);
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/budget-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const updated = (await response.json().catch(() => null)) as
        | BudgetItem
        | { message?: string; label?: string[]; monthly_amount?: string[] }
        | null;
      if (!response.ok || !updated || !("id" in updated)) {
        const message =
          updated && "message" in updated
            ? updated.message
            : updated && "label" in updated
              ? updated.label?.[0]
              : updated && "monthly_amount" in updated
                ? updated.monthly_amount?.[0]
                : undefined;
        throw new Error(message || "Unable to save the expense.");
      }
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEditingCell(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the expense.",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function saveAmount(itemId: number) {
    const item = items.find((candidate) => candidate.id === itemId);
    const amount = Number(inputValue);
    if (!item || !Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount of zero or more.");
      return;
    }
    await patchItem(itemId, { monthly_amount: item.monthly_amount });
  }

  async function saveLabel(itemId: number, label: string) {
    const trimmedLabel = label.trim();
    const current = items.find((item) => item.id === itemId);
    if (!trimmedLabel) {
      setError("Expense names cannot be blank.");
      if (current) {
        setItems((itemsNow) =>
          itemsNow.map((item) =>
            item.id === itemId ? { ...item, label: current.label } : item,
          ),
        );
      }
      return;
    }
    if (current?.label === trimmedLabel) return;
    await patchItem(itemId, { label: trimmedLabel });
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const monthlyAmount = Number(newExpense.monthlyAmount);
    if (!newExpense.label.trim() || !Number.isFinite(monthlyAmount) || monthlyAmount < 0) {
      setError("Enter an expense name and a valid monthly amount.");
      return;
    }

    setCreating(true);
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/budget-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newExpense.label.trim(),
          monthly_amount: monthlyAmount.toFixed(6),
        }),
      });
      const created = (await response.json().catch(() => null)) as
        | BudgetItem
        | { message?: string }
        | null;
      if (!response.ok || !created || !("id" in created)) {
        throw new Error(
          created && "message" in created && created.message
            ? created.message
            : "Unable to add the expense.",
        );
      }
      setItems((current) => [...current, created]);
      setNewExpense({ label: "", monthlyAmount: "" });
      setFormOpen(false);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to add the expense.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function deleteExpense(itemId: number) {
    setDeletingId(itemId);
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/budget-items/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Unable to delete the expense.");
      setItems((current) => current.filter((item) => item.id !== itemId));
      setConfirmingDeleteId(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the expense.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const totalMonthly = items.reduce(
    (total, item) => total + Number(item.monthly_amount),
    0,
  );

  return (
    <div className="surface mt-8 overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Recurring expenses
          </p>
          <p className="mt-1 text-sm text-muted">
            Edit any period to recalculate the others using a four-week
            budgeting month.
          </p>
        </div>
        <button
          className="rounded-xl bg-accent-strong px-4 py-2.5 text-sm font-semibold text-[#03120c] transition hover:bg-accent"
          onClick={() => setFormOpen((open) => !open)}
          type="button"
        >
          {formOpen ? "Cancel" : "Add expense"}
        </button>
      </div>

      {formOpen ? (
        <form
          className="grid gap-4 border-b border-white/10 bg-black/10 p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end sm:p-5"
          onSubmit={addExpense}
        >
          <label>
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Expense name
            </span>
            <input
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-accent/50"
              data-1p-ignore
              data-op-ignore
              onChange={(event) =>
                setNewExpense((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              placeholder="Property Taxes"
              required
              type="text"
              value={newExpense.label}
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Monthly amount
            </span>
            <input
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-right font-mono text-sm text-white outline-none focus:border-accent/50"
              data-1p-ignore
              data-op-ignore
              inputMode="decimal"
              onChange={(event) =>
                setNewExpense((current) => ({
                  ...current,
                  monthlyAmount: event.target.value,
                }))
              }
              placeholder="0.00"
              required
              type="text"
              value={newExpense.monthlyAmount}
            />
          </label>
          <button
            className="h-11 rounded-xl border border-accent/25 bg-accent/10 px-5 text-sm font-semibold text-accent transition hover:bg-accent/15 disabled:opacity-50"
            disabled={creating}
            type="submit"
          >
            {creating ? "Adding…" : "Add"}
          </button>
        </form>
      ) : null}

      {error ? (
        <p
          className="border-b border-rose-300/15 bg-rose-500/10 px-5 py-3 text-sm text-rose-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[minmax(220px,1fr)_repeat(4,minmax(160px,0.5fr))_100px] border-b border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <span>Expense</span>
            <span className="text-right">Weekly</span>
            <span className="text-right">Bi-Weekly</span>
            <span className="text-right">Monthly</span>
            <span className="text-right">Yearly</span>
            <span />
          </div>

          {items.map((item) => (
            <div
              className="grid grid-cols-[minmax(220px,1fr)_repeat(4,minmax(160px,0.5fr))_100px] items-center border-b border-white/[0.07] px-5 py-2.5"
              key={item.id}
            >
              <input
                autoComplete="off"
                className="h-9 min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium text-white/80 outline-none transition hover:border-white/10 hover:bg-white/[0.035] focus:border-accent/40 focus:bg-black/20"
                data-1p-ignore
                data-op-ignore
                disabled={savingId === item.id}
                defaultValue={item.label}
                onBlur={(event) => {
                  if (!event.target.value.trim()) {
                    event.target.value = item.label;
                  }
                  void saveLabel(item.id, event.target.value);
                }}
                type="text"
              />

              {budgetPeriods.map((period) => {
                const currentCellKey = cellKey(item.id, period);
                const editing = editingCell === currentCellKey;
                return (
                  <div className="flex justify-end" key={period}>
                    <div className="relative w-36">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                        $
                      </span>
                      <input
                        aria-label={`${item.label} ${period}`}
                        autoComplete="off"
                        className="h-9 w-full rounded-lg border border-transparent bg-transparent pl-7 pr-2 text-right font-mono text-sm text-white outline-none transition hover:border-white/10 hover:bg-white/[0.035] focus:border-accent/40 focus:bg-black/20 disabled:opacity-50"
                        data-1p-ignore
                        data-op-ignore
                        disabled={savingId === item.id}
                        inputMode="decimal"
                        onBlur={() => {
                          if (editing) void saveAmount(item.id);
                        }}
                        onChange={(event) =>
                          updateAmount(item.id, period, event.target.value)
                        }
                        onFocus={() => beginAmountEdit(item, period)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        type="text"
                        value={
                          editing
                            ? inputValue
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

              <div className="flex justify-end">
                {confirmingDeleteId === item.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      className="rounded-lg px-2 py-1.5 text-xs text-white/60 hover:bg-white/[0.05] hover:text-white"
                      disabled={deletingId === item.id}
                      onClick={() => setConfirmingDeleteId(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="rounded-lg bg-rose-500/15 px-2 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/25"
                      disabled={deletingId === item.id}
                      onClick={() => void deleteExpense(item.id)}
                      type="button"
                    >
                      {deletingId === item.id ? "…" : "Delete"}
                    </button>
                  </div>
                ) : (
                  <button
                    className="rounded-lg px-3 py-1.5 text-xs text-rose-200/60 transition hover:bg-rose-500/10 hover:text-rose-200"
                    onClick={() => setConfirmingDeleteId(item.id)}
                    type="button"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}

          {items.length ? (
            <div className="grid grid-cols-[minmax(220px,1fr)_repeat(4,minmax(160px,0.5fr))_100px] items-center bg-white/[0.045] px-5 py-4">
              <span className="text-sm font-semibold text-white">Total</span>
              {budgetPeriods.map((period) => (
                <span
                  className="text-right font-mono text-sm font-semibold text-accent"
                  key={period}
                >
                  {formatCurrency(amountForBudgetPeriod(totalMonthly, period))}
                </span>
              ))}
              <span />
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted">
              No recurring expenses yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
