"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { BudgetItem } from "@/lib/budget-item-types";
import type {
  CreditCardTransaction,
  ExpenseTag,
} from "@/lib/credit-card-transaction-types";
import type { ExpenseCategory } from "@/lib/expense-category-types";
import type {
  ExpenseAutomationCondition,
  ExpenseAutomationRule,
  ExpenseAutomationRunResult,
} from "@/lib/expense-automation-rule-types";
import { extractApiErrorDetail, extractApiErrorMessage } from "@/lib/api-error-message";
import { APP_BASE_PATH } from "@/lib/config";
import { formatAutomationRunMessage } from "@/lib/format-automation-run-message";
import { formatAutomationActionSummary } from "@/lib/expense-automation-summary";
import { selectTransactions } from "@/lib/transaction-selector";
import { AutomationRuleEditor } from "@/components/automation-rule-editor";

export function AutomationsDashboard({
  initialBudgetItems,
  initialCategories,
  initialCreditCardTransactions,
  initialRules,
  initialTags,
}: {
  initialBudgetItems: BudgetItem[];
  initialCategories: ExpenseCategory[];
  initialCreditCardTransactions: CreditCardTransaction[];
  initialRules: ExpenseAutomationRule[];
  initialTags: ExpenseTag[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [formOpen, setFormOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [savingRuleId, setSavingRuleId] = useState<number | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [runMessage, setRunMessage] = useState("");

  const budgetItemsById = useMemo(
    () => new Map(initialBudgetItems.map((item) => [item.id, item])),
    [initialBudgetItems],
  );
  const impactedRecordCounts = useMemo(
    () =>
      new Map(
        rules.map((rule) => {
          const conditions: ExpenseAutomationCondition[] = rule.conditions
            ?.length
            ? rule.conditions
            : [
                {
                  id: `rule-${rule.id}`,
                  field: rule.match_field,
                  operator: rule.match_operator,
                  value: rule.match_value,
                },
              ];

          return [
            rule.id,
            selectTransactions(
              initialCreditCardTransactions,
              conditions,
              rule.logic_operator,
            ).length,
          ];
        }),
      ),
    [initialCreditCardTransactions, rules],
  );

  function openCreateForm() {
    setFormOpen(true);
    setError("");
  }

  function closeForm() {
    setFormOpen(false);
    setError("");
  }

  function addSavedRule(saved: ExpenseAutomationRule) {
    setRules((current) => {
      const next = [...current, saved];
      return next.sort((left, right) => left.name.localeCompare(right.name));
    });
    closeForm();
  }

  async function toggleRule(rule: ExpenseAutomationRule, enabled: boolean) {
    setSavingRuleId(rule.id);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/expense-automation-rules/${rule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      const updated = (await response.json().catch(() => null)) as
        | ExpenseAutomationRule
        | { message?: string }
        | null;
      if (!response.ok || !updated || !("id" in updated)) {
        throw new Error(
          (updated && "message" in updated && updated.message) ||
            "Unable to update the automation rule.",
        );
      }
      setRules((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update the automation rule.",
      );
    } finally {
      setSavingRuleId(null);
    }
  }

  async function deleteRule(ruleId: number) {
    setDeletingRuleId(ruleId);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/expense-automation-rules/${ruleId}`,
        { method: "DELETE" },
      );
      if (!response.ok && response.status !== 204) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(payload?.message || "Unable to delete the rule.");
      }
      setRules((current) => current.filter((rule) => rule.id !== ruleId));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the automation rule.",
      );
    } finally {
      setDeletingRuleId(null);
    }
  }

  async function runRules() {
    setRunning(true);
    setError("");
    setRunMessage("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/expense-automation-rules/run`,
        { method: "POST" },
      );
      const result = (await response.json().catch(() => null)) as
        | ExpenseAutomationRunResult
        | { message?: string; detail?: string }
        | null;
      if (!response.ok || !result || !("processed_count" in result)) {
        const fallback = "Unable to run automation rules.";
        const message = extractApiErrorMessage(result, fallback);
        const detail = extractApiErrorDetail(result);
        throw new Error(detail ? `${message} (${detail})` : message);
      }
      setRunMessage(
        formatAutomationRunMessage({
          processed_count: result.processed_count,
        }),
      );
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "Unable to run automation rules.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Transaction rules
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Match imported credit-card transactions and apply every configured
            action. Automations also run when new statements are imported.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:border-accent/25 hover:bg-accent/10"
            disabled={running}
            onClick={() => void runRules()}
            type="button"
          >
            {running ? "Running automations…" : "Run Automations"}
          </button>
          <button
            className="rounded-xl border border-accent/30 bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20"
            onClick={() => (formOpen ? closeForm() : openCreateForm())}
            type="button"
          >
            {formOpen ? "Close form" : "New rule"}
          </button>
        </div>
      </div>

      {error ? (
        <p
          className="rounded-xl border border-rose-300/15 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {runMessage ? (
        <p className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent">
          {runMessage}
        </p>
      ) : null}

      {formOpen ? (
        <AutomationRuleEditor
          initialBudgetItems={initialBudgetItems}
          initialCategories={initialCategories}
          initialCreditCardTransactions={initialCreditCardTransactions}
          initialTags={initialTags}
          onCancel={closeForm}
          onSaved={addSavedRule}
        />
      ) : null}

      <div className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-white">Active rules</h2>
          <p className="mt-1 text-sm text-muted">
            {rules.length
              ? `${rules.filter((rule) => rule.enabled).length} enabled of ${rules.length} total`
              : "No automation rules yet."}
          </p>
        </div>
        {rules.length ? (
          rules.map((rule) => {
            const impactedRecordCount = impactedRecordCounts.get(rule.id) ?? 0;

            return (
              <div
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-white/[0.07] px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:px-5"
                key={rule.id}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <Link
                      className="min-w-0 text-sm font-semibold text-white transition hover:text-accent"
                      href={`/dashboard/automations/${rule.id}`}
                    >
                      {rule.name}
                    </Link>
                    {!rule.enabled ? (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
                        Disabled
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatAutomationActionSummary(rule, budgetItemsById)}
                  </p>
                </div>
                <span
                  aria-label={`${impactedRecordCount} impacted ${
                    impactedRecordCount === 1 ? "record" : "records"
                  }`}
                  className="justify-self-end text-sm font-semibold tabular-nums text-white/70"
                  title={`${impactedRecordCount} impacted ${
                    impactedRecordCount === 1 ? "record" : "records"
                  }`}
                >
                  {impactedRecordCount}
                </span>
                <label className="flex items-center gap-2 text-xs text-white/60">
                  <input
                    checked={rule.enabled}
                    className="size-4 rounded border-white/20 bg-black/20 text-accent focus:ring-accent/40 disabled:opacity-50"
                    disabled={savingRuleId === rule.id}
                    onChange={(event) =>
                      void toggleRule(rule, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>Enabled</span>
                </label>
                <button
                  className="justify-self-end rounded-md px-2 py-1 text-xs text-rose-200/80 hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
                  disabled={deletingRuleId === rule.id}
                  onClick={() => void deleteRule(rule.id)}
                  type="button"
                >
                  {deletingRuleId === rule.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            );
          })
        ) : (
          <p className="px-4 py-8 text-sm text-muted sm:px-5">
            Create a rule to turn matching credit-card transactions into expense
            entries automatically.
          </p>
        )}
      </div>
    </div>
  );
}
