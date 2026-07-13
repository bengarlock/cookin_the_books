"use client";

import { useState } from "react";

import type { BudgetItem } from "@/lib/budget-item-types";
import type { ExpenseCategory } from "@/lib/expense-category-types";
import type { ExpenseAutomationAction } from "@/lib/expense-automation-rule-types";
import { slugifyCategoryLabel, sortedCategoryOptions } from "@/lib/transaction-categories";

const choices = [
  { type: "assign_category", label: "Assign Category" },
  { type: "assign_tag", label: "Assign Tag" },
  { type: "set_budget_treatment", label: "Budget Treatment" },
  { type: "create_expense", label: "Create Expense" },
] as const;

export function AutomationActionBuilder({
  actions,
  categories,
  expenses,
  tags,
  onChange,
  onCreateTag,
}: {
  actions: ExpenseAutomationAction[];
  categories: ExpenseCategory[];
  expenses: BudgetItem[];
  tags: string[];
  onChange: (actions: ExpenseAutomationAction[]) => void;
  onCreateTag: (tag: string) => string;
}) {
  const [creatingTagFor, setCreatingTagFor] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [creatingCategoryFor, setCreatingCategoryFor] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  const customCategories = actions.flatMap((action) =>
    action.type === "assign_category" && action.category
      ? [{ value: action.category, label: action.category_label || action.category }]
      : [],
  );
  const categoryOptions = Array.from(
    new Map(
      [
        ...sortedCategoryOptions(categories).map((category) => ({
          value: category.key,
          label: category.label,
        })),
        ...customCategories,
      ].map((category) => [
        category.value,
        category,
      ]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label));

  function add(type: ExpenseAutomationAction["type"]) {
    const id = crypto.randomUUID();
    onChange([
      ...actions,
      type === "create_expense"
        ? { id, type, budget_item: "", note: "", exclude_from_credit_card: true }
        : type === "assign_tag"
          ? { id, type, tag: "" }
          : type === "assign_category"
            ? { id, type, category: "" }
            : { id, type, split: false, include: true },
    ]);
  }

  function update(id: string, patch: Partial<ExpenseAutomationAction>) {
    onChange(
      actions.map((action) =>
        action.id === id
          ? ({ ...action, ...patch } as ExpenseAutomationAction)
          : action,
      ),
    );
  }

  function createTag(actionId: string) {
    const createdTag = onCreateTag(newTagName);
    if (!createdTag) return;
    update(actionId, { tag: createdTag });
    setNewTagName("");
    setCreatingTagFor(null);
  }

  function createCategory(actionId: string) {
    const label = newCategoryName.trim().replace(/\s+/g, " ");
    const category = slugifyCategoryLabel(label);
    if (!label || !category) return;
    const existing = categoryOptions.find(
      (option) => option.value === category || option.label.toLowerCase() === label.toLowerCase(),
    );
    update(actionId, {
      category: existing?.value || category,
      category_label: existing?.label || label,
    });
    setNewCategoryName("");
    setCreatingCategoryFor(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div
        className="min-h-52 rounded-2xl border border-dashed border-white/15 bg-black/10 p-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const type = event.dataTransfer.getData(
            "text/plain",
          ) as ExpenseAutomationAction["type"];
          if (choices.some((choice) => choice.type === type)) add(type);
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          Action staging area
        </p>
        <p className="mt-1 text-xs text-muted">
          Drag actions here or click them in the palette. Every staged action
          runs on matching records.
        </p>
        <div className="mt-4 space-y-3">
          {actions.map((action) => (
            <div
              className="rounded-xl border border-white/10 bg-white/[0.035] p-3"
              key={action.id}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">
                  {action.type === "create_expense"
                    ? "Create Expense"
                    : action.type === "assign_tag"
                      ? "Assign Tag"
                      : action.type === "assign_category"
                        ? "Assign Category"
                        : "Budget Treatment"}
                </span>
                <button
                  className="text-lg text-white/35 hover:text-rose-200"
                  onClick={() =>
                    onChange(actions.filter((item) => item.id !== action.id))
                  }
                  type="button"
                >
                  ×
                </button>
              </div>
              {action.type === "create_expense" ? (
                <div className="mt-3 grid gap-3">
                  <select
                    className="rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-sm text-white"
                    onChange={(event) =>
                      update(action.id, { budget_item: event.target.value })
                    }
                    value={action.budget_item}
                  >
                    <option value="">Select an expense category</option>
                    {expenses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                    onChange={(event) =>
                      update(action.id, { note: event.target.value })
                    }
                    placeholder="Expense note (optional)"
                    value={action.note}
                  />
                  <label className="flex gap-2 text-sm text-white/70">
                    <input
                      checked={action.exclude_from_credit_card}
                      onChange={(event) =>
                        update(action.id, {
                          exclude_from_credit_card: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    Exclude from credit card
                  </label>
                </div>
              ) : action.type === "set_budget_treatment" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    aria-pressed={action.split}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${action.split ? "border-violet-300/30 bg-violet-400/15 text-violet-100" : "border-white/10 text-white/45 hover:text-white/70"}`}
                    onClick={() => update(action.id, { split: !action.split })}
                    type="button"
                  >
                    Split
                  </button>
                  <button
                    aria-pressed={action.include}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${action.include ? "border-accent/25 bg-accent/10 text-accent" : "border-rose-300/20 bg-rose-400/10 text-rose-100"}`}
                    onClick={() => update(action.id, { include: !action.include })}
                    type="button"
                  >
                    {action.include ? "Included" : "Excluded"}
                  </button>
                  <p className="w-full text-xs text-muted">
                    Set how matching transactions contribute to budget totals.
                  </p>
                </div>
              ) : action.type === "assign_category" ? (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <select
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-sm text-white"
                      onChange={(event) => {
                        const selected = categoryOptions.find((category) => category.value === event.target.value);
                        update(action.id, {
                          category: event.target.value,
                          category_label: selected?.label,
                        });
                      }}
                      value={action.category}
                    >
                      <option value="">Select a category</option>
                      {categoryOptions.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label="Create a new category"
                      className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 text-lg text-white/60 transition hover:border-sky-300/30 hover:text-sky-100"
                      onClick={() => {
                        setCreatingCategoryFor(creatingCategoryFor === action.id ? null : action.id);
                        setNewCategoryName("");
                      }}
                      title="Create a new category"
                      type="button"
                    >
                      +
                    </button>
                  </div>
                  {creatingCategoryFor === action.id ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        autoFocus
                        className="h-9 min-w-48 flex-1 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50"
                        maxLength={60}
                        onChange={(event) => setNewCategoryName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            createCategory(action.id);
                          }
                        }}
                        placeholder="Create a category"
                        value={newCategoryName}
                      />
                      <button
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70"
                        onClick={() => createCategory(action.id)}
                        type="button"
                      >
                        Add
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3">
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Available tags
                    </p>
                    <button
                      aria-label="Create a new tag"
                      className="grid size-6 place-items-center rounded-full border border-white/10 text-sm text-white/60 transition hover:border-sky-300/30 hover:text-sky-100"
                      onClick={() => {
                        setCreatingTagFor(
                          creatingTagFor === action.id ? null : action.id,
                        );
                        setNewTagName("");
                      }}
                      title="Create a new tag"
                      type="button"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        className={`rounded-full border px-2.5 py-1 text-xs ${action.tag === tag ? "border-sky-300/20 bg-sky-400/10 text-sky-100" : "border-white/10 text-white/65 hover:border-sky-300/20 hover:text-sky-100"}`}
                        key={tag}
                        onClick={() => update(action.id, { tag })}
                        type="button"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  {creatingTagFor === action.id ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        autoFocus
                        className="h-9 min-w-48 flex-1 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50"
                        maxLength={40}
                        onChange={(event) => setNewTagName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            createTag(action.id);
                          }
                        }}
                        placeholder="Create a tag"
                        value={newTagName}
                      />
                      <button
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70"
                        onClick={() => createTag(action.id)}
                        type="button"
                      >
                        Add
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
          {!actions.length ? (
            <div className="grid min-h-24 place-items-center text-sm text-muted">
              Drop an action here to begin.
            </div>
          ) : null}
        </div>
      </div>
      <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold">
          Actions
        </p>
        <div className="mt-3 space-y-1">
          {choices.map((choice) => (
            <button
              className="flex w-full cursor-grab items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/70 hover:bg-accent/10 hover:text-accent"
              draggable
              key={choice.type}
              onClick={() => add(choice.type)}
              onDragStart={(event) =>
                event.dataTransfer.setData("text/plain", choice.type)
              }
              type="button"
            >
              <span>⠿</span>
              {choice.label}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
