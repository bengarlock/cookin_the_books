"use client";

import { useState } from "react";

import type { BudgetItem } from "@/lib/budget-item-types";
import type { ExpenseAutomationAction } from "@/lib/expense-automation-rule-types";

const choices = [
  { type: "assign_category", label: "Assign Category" },
  { type: "assign_tag", label: "Assign Tag" },
  { type: "create_expense", label: "Create Expense" },
] as const;

const categories = [
  { value: "dining", label: "Dining" },
  { value: "groceries", label: "Groceries" },
  { value: "transportation", label: "Transportation" },
  { value: "housing", label: "Housing" },
  { value: "utilities", label: "Utilities" },
  { value: "shopping", label: "Shopping" },
  { value: "health", label: "Health" },
  { value: "entertainment", label: "Entertainment" },
  { value: "travel", label: "Travel" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "fees_interest", label: "Fees & interest" },
];

export function AutomationActionBuilder({
  actions,
  expenses,
  tags,
  onChange,
  onCreateTag,
}: {
  actions: ExpenseAutomationAction[];
  expenses: BudgetItem[];
  tags: string[];
  onChange: (actions: ExpenseAutomationAction[]) => void;
  onCreateTag: (tag: string) => string;
}) {
  const [creatingTagFor, setCreatingTagFor] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");

  function add(type: ExpenseAutomationAction["type"]) {
    const id = crypto.randomUUID();
    onChange([
      ...actions,
      type === "create_expense"
        ? { id, type, budget_item: "", note: "", exclude_from_credit_card: true }
        : type === "assign_tag"
          ? { id, type, tag: "" }
          : { id, type, category: "" },
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
                      : "Assign Category"}
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
              ) : action.type === "assign_category" ? (
                <select
                  className="mt-3 w-full rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-sm text-white"
                  onChange={(event) =>
                    update(action.id, { category: event.target.value })
                  }
                  value={action.category}
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
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
