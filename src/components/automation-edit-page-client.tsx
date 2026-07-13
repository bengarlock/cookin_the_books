"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { AutomationRuleEditor } from "@/components/automation-rule-editor";
import { extractApiErrorMessage } from "@/lib/api-error-message";
import type { BudgetItem } from "@/lib/budget-item-types";
import { APP_BASE_PATH } from "@/lib/config";
import type {
  CreditCardTransaction,
  ExpenseTag,
} from "@/lib/credit-card-transaction-types";
import type { ExpenseAutomationRule } from "@/lib/expense-automation-rule-types";

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
      <path
        d="m5 16.6-.75 3.15L7.4 19 18.25 8.15l-2.4-2.4L5 16.6Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m14.75 6.85 2.4 2.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function AutomationEditPageClient({
  initialBudgetItems,
  initialCreditCardTransactions,
  initialRule,
  initialTags,
}: {
  initialBudgetItems: BudgetItem[];
  initialCreditCardTransactions: CreditCardTransaction[];
  initialRule: ExpenseAutomationRule;
  initialTags: ExpenseTag[];
}) {
  const router = useRouter();
  const [rule, setRule] = useState(initialRule);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initialRule.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");

  function openNameEditor() {
    setNameDraft(rule.name);
    setNameError("");
    setEditingName(true);
  }

  function closeNameEditor() {
    setNameDraft(rule.name);
    setNameError("");
    setEditingName(false);
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = nameDraft.trim();
    if (!nextName) {
      setNameError("Enter an automation name.");
      return;
    }
    if (nextName === rule.name) {
      closeNameEditor();
      return;
    }

    setSavingName(true);
    setNameError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/expense-automation-rules/${rule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nextName }),
        },
      );
      const updated = (await response.json().catch(() => null)) as
        | ExpenseAutomationRule
        | { message?: string; detail?: string; name?: string[] }
        | null;
      if (!response.ok || !updated || !("id" in updated)) {
        throw new Error(
          extractApiErrorMessage(
            updated,
            "Unable to update the automation name.",
          ),
        );
      }

      setRule(updated);
      setNameDraft(updated.name);
      setEditingName(false);
      router.refresh();
    } catch (saveError) {
      setNameError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update the automation name.",
      );
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Automation
          </p>
          {editingName ? (
            <form className="mt-1 space-y-2" onSubmit={(event) => void saveName(event)}>
              <div className="flex max-w-2xl flex-wrap items-center gap-2">
                <input
                  autoFocus
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xl font-semibold text-white outline-none focus:border-accent/40"
                  disabled={savingName}
                  onChange={(event) => setNameDraft(event.target.value)}
                  value={nameDraft}
                />
                <button
                  className="rounded-xl border border-accent/30 bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50"
                  disabled={savingName}
                  type="submit"
                >
                  {savingName ? "Saving..." : "Save"}
                </button>
                <button
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
                  disabled={savingName}
                  onClick={closeNameEditor}
                  type="button"
                >
                  Cancel
                </button>
              </div>
              {nameError ? (
                <p className="text-sm text-rose-100" role="alert">
                  {nameError}
                </p>
              ) : null}
            </form>
          ) : (
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <h1 className="min-w-0 text-2xl font-semibold text-white">
                {rule.name}
              </h1>
              <button
                aria-label="Edit automation name"
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/65 transition hover:border-accent/25 hover:bg-accent/10 hover:text-accent"
                onClick={openNameEditor}
                title="Edit automation name"
                type="button"
              >
                <PencilIcon />
              </button>
            </div>
          )}
        </div>
        <Link
          className="self-start rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:border-accent/25 hover:bg-accent/10 sm:self-auto"
          href="/dashboard/automations"
        >
          Back to automations
        </Link>
      </div>

      <AutomationRuleEditor
        cancelHref="/dashboard/automations"
        displayName={rule.name}
        initialBudgetItems={initialBudgetItems}
        initialCreditCardTransactions={initialCreditCardTransactions}
        initialRule={rule}
        initialTags={initialTags}
        onSaved={setRule}
        showNameField={false}
      />
    </div>
  );
}
