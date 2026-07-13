"use client";

import { FormEvent, useState } from "react";

import { extractApiErrorMessage } from "@/lib/api-error-message";
import { APP_BASE_PATH } from "@/lib/config";
import type { ExpenseCategory } from "@/lib/expense-category-types";

export function CategorySettings({
  initialCategories,
}: {
  initialCategories: ExpenseCategory[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const sortedCategories = [...categories].sort((left, right) =>
    left.label.localeCompare(right.label),
  );

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = newCategoryName.trim().replace(/\s+/g, " ");
    if (!label) return;

    setBusyId("new");
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/expense-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = (await response.json().catch(() => null)) as
        | ExpenseCategory
        | { message?: string }
        | null;
      if (!response.ok || !data || !("id" in data)) {
        throw new Error(extractApiErrorMessage(data, "The category could not be added."));
      }
      setCategories((current) =>
        [...current, data].sort((left, right) => left.label.localeCompare(right.label)),
      );
      setNewCategoryName("");
      setStatus(`${data.label} added.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "The category could not be added.");
    } finally {
      setBusyId(null);
    }
  }

  function beginEdit(category: ExpenseCategory) {
    setEditingId(category.id);
    setEditingName(category.label);
    setError("");
    setStatus("");
  }

  async function saveCategory(category: ExpenseCategory) {
    const label = editingName.trim().replace(/\s+/g, " ");
    if (!label) return;

    setBusyId(category.id);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/expense-categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = (await response.json().catch(() => null)) as
        | ExpenseCategory
        | { message?: string }
        | null;
      if (!response.ok || !data || !("id" in data)) {
        throw new Error(extractApiErrorMessage(data, "The category could not be saved."));
      }
      setCategories((current) => current.map((item) => (item.id === data.id ? data : item)));
      setEditingId(null);
      setEditingName("");
      setStatus(`${data.label} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The category could not be saved.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteCategory(category: ExpenseCategory) {
    setBusyId(category.id);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/expense-categories/${category.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(extractApiErrorMessage(data, "The category could not be deleted."));
      }
      setCategories((current) => current.filter((item) => item.id !== category.id));
      setStatus(`${category.label} deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The category could not be deleted.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          Transactions
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">Categories</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Manage the categories used for transaction corrections and automation actions.
        </p>
      </div>

      {error ? (
        <p className="border-b border-rose-300/15 bg-rose-300/10 px-5 py-3 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="border-b border-accent/15 bg-accent/10 px-5 py-3 text-sm text-accent" role="status">
          {status}
        </p>
      ) : null}

      <form className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row" onSubmit={createCategory}>
        <input
          className="min-h-11 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-accent/50"
          onChange={(event) => setNewCategoryName(event.target.value)}
          placeholder="New category name"
          value={newCategoryName}
        />
        <button
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-[#07100f] disabled:opacity-50"
          disabled={busyId === "new" || !newCategoryName.trim()}
          type="submit"
        >
          {busyId === "new" ? "Adding..." : "Add category"}
        </button>
      </form>

      <div className="divide-y divide-white/10">
        {sortedCategories.map((category) => (
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" key={category.id || category.key}>
            <div className="min-w-0">
              {editingId === category.id ? (
                <input
                  className="min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-accent/50 sm:w-80"
                  onChange={(event) => setEditingName(event.target.value)}
                  value={editingName}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white">{category.label}</h3>
                    {category.is_default ? (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">{category.key}</p>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {editingId === category.id ? (
                <>
                  <button
                    className="rounded-lg border border-accent/25 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50"
                    disabled={busyId === category.id || !editingName.trim()}
                    onClick={() => void saveCategory(category)}
                    type="button"
                  >
                    {busyId === category.id ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-muted"
                    onClick={() => {
                      setEditingId(null);
                      setEditingName("");
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="rounded-lg border border-accent/25 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50"
                    disabled={busyId === category.id}
                    onClick={() => beginEdit(category)}
                    type="button"
                  >
                    Rename
                  </button>
                  {!category.is_default ? (
                    <button
                      className="rounded-lg border border-rose-300/25 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-50"
                      disabled={busyId === category.id}
                      onClick={() => void deleteCategory(category)}
                      type="button"
                    >
                      {busyId === category.id ? "Deleting..." : "Delete"}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
