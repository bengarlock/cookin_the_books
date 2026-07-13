"use client";

import { FormEvent, useState } from "react";

import { extractApiErrorMessage } from "@/lib/api-error-message";
import { APP_BASE_PATH } from "@/lib/config";
import type { ExpenseCategory } from "@/lib/expense-category-types";

function categoryIdentity(category: ExpenseCategory) {
  return category.id ? `id:${category.id}` : `key:${category.key}`;
}

function categoryIsPersisted(category: ExpenseCategory) {
  return category.id > 0;
}

export function CategorySettings({
  initialCategories,
}: {
  initialCategories: ExpenseCategory[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyCategory, setBusyCategory] = useState<string | "new" | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const sortedCategories = [...categories].sort((left, right) =>
    left.label.localeCompare(right.label),
  );

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = newCategoryName.trim().replace(/\s+/g, " ");
    if (!label) return;

    setBusyCategory("new");
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
      setBusyCategory(null);
    }
  }

  function beginEdit(category: ExpenseCategory) {
    if (!categoryIsPersisted(category)) {
      setError("Categories are not connected to the dev backend yet. Restart the backend and reload this page.");
      return;
    }
    setEditingCategory(categoryIdentity(category));
    setEditingName(category.label);
    setError("");
    setStatus("");
  }

  async function saveCategory(category: ExpenseCategory) {
    const label = editingName.trim().replace(/\s+/g, " ");
    if (!label) return;

    const identity = categoryIdentity(category);
    setBusyCategory(identity);
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
      setCategories((current) =>
        current.map((item) => (categoryIdentity(item) === identity ? data : item)),
      );
      setEditingCategory(null);
      setEditingName("");
      setStatus(`${data.label} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The category could not be saved.");
    } finally {
      setBusyCategory(null);
    }
  }

  async function deleteCategory(category: ExpenseCategory) {
    const identity = categoryIdentity(category);
    setBusyCategory(identity);
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
      setCategories((current) =>
        current.filter((item) => categoryIdentity(item) !== identity),
      );
      setStatus(`${category.label} deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The category could not be deleted.");
    } finally {
      setBusyCategory(null);
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
          disabled={busyCategory === "new" || !newCategoryName.trim()}
          type="submit"
        >
          {busyCategory === "new" ? "Adding..." : "Add category"}
        </button>
      </form>

      <div className="divide-y divide-white/10">
        {sortedCategories.map((category) => {
          const identity = categoryIdentity(category);
          return (
            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" key={identity}>
              <div className="min-w-0">
                {editingCategory === identity ? (
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
                {editingCategory === identity ? (
                  <>
                    <button
                      className="rounded-lg border border-accent/25 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50"
                      disabled={busyCategory === identity || !editingName.trim()}
                      onClick={() => void saveCategory(category)}
                      type="button"
                    >
                      {busyCategory === identity ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs text-muted"
                      onClick={() => {
                        setEditingCategory(null);
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
                      disabled={busyCategory === identity || !categoryIsPersisted(category)}
                      onClick={() => beginEdit(category)}
                      type="button"
                    >
                      Rename
                    </button>
                    {!category.is_default ? (
                      <button
                        className="rounded-lg border border-rose-300/25 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-50"
                        disabled={busyCategory === identity}
                        onClick={() => void deleteCategory(category)}
                        type="button"
                      >
                        {busyCategory === identity ? "Deleting..." : "Delete"}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
