"use client";

import { FormEvent, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type { BudgetItem } from "@/lib/budget-item-types";
import type {
  ExpenseAutomationCondition,
  ExpenseAutomationAction,
  ExpenseAutomationMatchField,
  ExpenseAutomationMatchOperator,
  ExpenseAutomationRule,
  ExpenseAutomationRunResult,
} from "@/lib/expense-automation-rule-types";
import { AutomationSelectorBuilder } from "@/components/automation-selector-builder";
import { AutomationActionBuilder } from "@/components/automation-action-builder";
import type { CreditCardTransaction, ExpenseTag } from "@/lib/credit-card-transaction-types";
import { extractApiErrorDetail, extractApiErrorMessage } from "@/lib/api-error-message";
import { APP_BASE_PATH } from "@/lib/config";
import { formatAutomationRunMessage } from "@/lib/format-automation-run-message";
import { formatAutomationActionSummary } from "@/lib/expense-automation-summary";


const emptyRuleForm = {
  name: "",
  match_field: "description" as ExpenseAutomationMatchField,
  match_operator: "contains" as ExpenseAutomationMatchOperator,
  match_value: "",
  target_budget_item: "",
  note_template: "",
  exclude_from_credit_card: true,
  conditions: [] as ExpenseAutomationCondition[],
  actions: [] as ExpenseAutomationAction[],
  logic_operator: "and" as "and" | "or",
};

function ruleToForm(rule: ExpenseAutomationRule) {
  return {
    name: rule.name,
    match_field: rule.match_field,
    match_operator: rule.match_operator,
    match_value: rule.match_value,
    target_budget_item: String(rule.target_budget_item),
    note_template: rule.note_template,
    exclude_from_credit_card: rule.exclude_from_credit_card ?? true,
    conditions: (rule.conditions?.length ? rule.conditions : [{
      id: crypto.randomUUID(), field: rule.match_field, operator: rule.match_operator,
      value: rule.match_value,
    }]).map((condition) => ({ ...condition, id: condition.id || crypto.randomUUID() })),
    actions: (rule.actions?.length ? rule.actions : rule.target_budget_item ? [{ type: "create_expense" as const, budget_item: String(rule.target_budget_item), note: rule.note_template, exclude_from_credit_card: rule.exclude_from_credit_card }] : []).map((action) => ({ ...action, budget_item: action.type === "create_expense" ? String(action.budget_item) : undefined, id: crypto.randomUUID() })) as ExpenseAutomationAction[],
    logic_operator: rule.logic_operator || "and",
  };
}

function transactionMatchesCondition(
  transaction: CreditCardTransaction,
  condition: ExpenseAutomationCondition,
) {
  if (!["purchase", "fee", "interest"].includes(transaction.transaction_type)) {
    return false;
  }

  const fieldValue =
    condition.field === "description"
      ? transaction.description
      : condition.field === "issuer"
        ? transaction.issuer
        : condition.field === "transaction_type" ? transaction.transaction_type
          : condition.field === "account_last_four" ? transaction.account_last_four
            : condition.field === "amount" ? transaction.amount
              : condition.field === "transaction_date" ? transaction.transaction_date
                : (transaction.tags || []).map((tag) => tag.name).join(" ");

  if (condition.field === "account_last_four") {
    return Array.isArray(condition.value) && condition.value.includes(transaction.account_last_four);
  }
  const normalizeDescription = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => !["null", "none", "nan"].includes(token) && !/^x{4,}\d{0,4}$/.test(token)).join(" ") || "";
  const value = condition.field === "description" ? normalizeDescription(fieldValue) : fieldValue.toLowerCase();
  const targets = (Array.isArray(condition.value) ? condition.value : [condition.value]).map((item) => condition.field === "description" ? normalizeDescription(String(item)) : String(item).toLowerCase());
  const contains = (target: string) => condition.field === "description" ? value === target || ` ${value} `.includes(` ${target} `) : value.includes(target);
  if (condition.operator === "contains") return targets.some(contains);
  if (condition.operator === "not_contains") return targets.every((target) => !contains(target));
  if (condition.operator === "equals") return targets.some((target) => value === target);
  if (condition.operator === "not_equals") return targets.every((target) => value !== target);
  if (condition.operator === "starts_with") return targets.some((target) => value.startsWith(target));
  if (condition.operator === "greater_than") return Number(fieldValue) > Number(condition.value);
  if (condition.operator === "less_than") return Number(fieldValue) < Number(condition.value);
  if (condition.operator === "on_or_after") return fieldValue >= condition.value;
  if (condition.operator === "on_or_before") return fieldValue <= condition.value;
  return false;
}

export function AutomationsDashboard({
  initialBudgetItems,
  initialCreditCardTransactions,
  initialRules,
  initialTags,
}: {
  initialBudgetItems: BudgetItem[];
  initialCreditCardTransactions: CreditCardTransaction[];
  initialRules: ExpenseAutomationRule[];
  initialTags: ExpenseTag[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyRuleForm);
  const [savingForm, setSavingForm] = useState(false);
  const [running, setRunning] = useState(false);
  const [savingRuleId, setSavingRuleId] = useState<number | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [runMessage, setRunMessage] = useState("");
  const [formHost, setFormHost] = useState<HTMLDivElement | null>(null);
  const [availableTags, setAvailableTags] = useState(() =>
    Array.from(
      new Set([
        ...initialTags.map((tag) => tag.name),
        ...initialCreditCardTransactions.flatMap((transaction) =>
          (transaction.tags || []).map((tag) => tag.name),
        ),
      ]),
    ).sort((a, b) => a.localeCompare(b)),
  );

  const budgetItemsById = useMemo(
    () => new Map(initialBudgetItems.map((item) => [item.id, item])),
    [initialBudgetItems],
  );

  const expenseTargets = useMemo(
    () =>
      initialBudgetItems
        .filter((item) => item.key !== "credit-card")
        .sort((left, right) => left.sort_order - right.sort_order),
    [initialBudgetItems],
  );
  const accountOptions = useMemo(() => {
    const accounts = new Map<string, string>();
    initialCreditCardTransactions.forEach((transaction) => {
      if (
        /^\d{4}$/.test(transaction.account_last_four) &&
        ["purchase", "fee", "interest"].includes(transaction.transaction_type)
      ) {
        accounts.set(
          transaction.account_last_four,
          `${transaction.issuer} •••• ${transaction.account_last_four}`,
        );
      }
    });
    return Array.from(accounts, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [initialCreditCardTransactions]);
  const descriptionOptions = useMemo(() => Array.from(new Set(initialCreditCardTransactions.map((transaction) => transaction.description).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [initialCreditCardTransactions]);

  function createTag(name: string) {
    const cleaned = name.trim();
    if (!cleaned) return "";
    const existing = availableTags.find(
      (tag) => tag.toLowerCase() === cleaned.toLowerCase(),
    );
    const selected = existing || cleaned;
    if (!existing) {
      setAvailableTags((current) =>
        [...current, cleaned].sort((a, b) => a.localeCompare(b)),
      );
    }
    return selected;
  }

  const conditionIsEmpty = (condition: ExpenseAutomationCondition) =>
    Array.isArray(condition.value)
      ? !condition.value.length
      : !condition.value.trim();

  const previewMatches = useMemo(() => {
    if (!form.conditions.length || form.conditions.some(conditionIsEmpty)) return [];

    const draftRule: ExpenseAutomationRule = {
      id: 0,
      name: form.name || "Draft rule",
      enabled: true,
      match_field: form.match_field,
      match_operator: form.match_operator,
      match_value: form.match_value.trim(),
      target_budget_item: Number(form.target_budget_item) || 0,
      note_template: form.note_template,
      exclude_from_credit_card: form.exclude_from_credit_card,
      created_at: "",
      updated_at: "",
      conditions: form.conditions,
      actions: form.actions.map((action) => action.type === "create_expense" ? { type: action.type, budget_item: action.budget_item, note: action.note, exclude_from_credit_card: action.exclude_from_credit_card } : action.type === "assign_tag" ? { type: action.type, tag: action.tag } : { type: action.type, category: action.category }),
      logic_operator: form.logic_operator,
    };

    return initialCreditCardTransactions
      .filter((transaction) => {
        const results = draftRule.conditions.map((condition) => transactionMatchesCondition(transaction, condition));
        return draftRule.logic_operator === "or" ? results.some(Boolean) : results.every(Boolean);
      });
  }, [form, initialCreditCardTransactions]);

  function openCreateForm() {
    setFormHost(null);
    setEditingRuleId(null);
    setForm(emptyRuleForm);
    setFormOpen(true);
    setError("");
  }

  function openEditForm(rule: ExpenseAutomationRule) {
    setFormHost(null);
    setEditingRuleId(rule.id);
    setForm(ruleToForm(rule));
    setFormOpen(true);
    setError("");
  }

  function closeForm() {
    setFormOpen(false);
    setEditingRuleId(null);
    setForm(emptyRuleForm);
    setError("");
  }

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !form.name.trim() ||
      !form.conditions.length || form.conditions.some(conditionIsEmpty) ||
      !form.actions.length || form.actions.some((action) => action.type === "create_expense" ? !action.budget_item : action.type === "assign_tag" ? !action.tag.trim() : !action.category)
    ) {
      setError("Enter a rule name, match text, and target expense.");
      return;
    }

    const firstCondition = form.conditions[0];
    const compatibilityField = ["description", "issuer", "transaction_type"].includes(firstCondition.field)
      ? firstCondition.field as ExpenseAutomationMatchField
      : "description";
    const compatibilityOperator = ["contains", "equals"].includes(firstCondition.operator)
      ? firstCondition.operator as ExpenseAutomationMatchOperator
      : "contains";
    const compatibilityValue = Array.isArray(firstCondition.value)
      ? firstCondition.value.join(",")
      : firstCondition.value;
    const payload = {
      name: form.name.trim(),
      match_field: compatibilityField,
      match_operator: compatibilityOperator,
      match_value: compatibilityValue,
      target_budget_item: form.actions.find((action) => action.type === "create_expense")?.budget_item || null,
      note_template: form.note_template.trim(),
      exclude_from_credit_card: form.exclude_from_credit_card,
      conditions: form.conditions.map(({ field, operator, value }) => ({ field, operator, value })),
      logic_operator: form.logic_operator,
      actions: form.actions.map((action) => action.type === "create_expense" ? { type: action.type, budget_item: action.budget_item, note: action.note, exclude_from_credit_card: action.exclude_from_credit_card } : action.type === "assign_tag" ? { type: action.type, tag: action.tag } : { type: action.type, category: action.category }),
    };

    setSavingForm(true);
    setError("");
    try {
      const response = await fetch(
        editingRuleId
          ? `${APP_BASE_PATH}/api/expense-automation-rules/${editingRuleId}`
          : `${APP_BASE_PATH}/api/expense-automation-rules`,
        {
          method: editingRuleId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const saved = (await response.json().catch(() => null)) as
        | ExpenseAutomationRule
        | { message?: string; name?: string[]; match_value?: string[] }
        | null;
      if (!response.ok || !saved || !("id" in saved)) {
        const message =
          saved && "message" in saved
            ? saved.message
            : saved && "name" in saved
              ? saved.name?.[0]
              : saved && "match_value" in saved
                ? saved.match_value?.[0]
                : undefined;
        throw new Error(
          message ||
            (editingRuleId
              ? "Unable to update the automation rule."
              : "Unable to create the automation rule."),
        );
      }

      setRules((current) => {
        const next = editingRuleId
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved];
        return next.sort((left, right) => left.name.localeCompare(right.name));
      });
      closeForm();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : editingRuleId
            ? "Unable to update the automation rule."
            : "Unable to create the automation rule.",
      );
    } finally {
      setSavingForm(false);
    }
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
      if (editingRuleId === ruleId) {
        closeForm();
      }
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

      <div ref={editingRuleId === null ? setFormHost : undefined} />

      {formOpen && formHost ? createPortal((
        <form
          className="surface overflow-hidden rounded-2xl"
          onSubmit={(event) => void saveRule(event)}
        >
          <div className="border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
            <h2 className="text-sm font-semibold text-white">
              {editingRuleId ? "Edit rule" : "Create rule"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Example: when a transaction description contains{" "}
              <span className="text-white/80">MERCHANT KEYWORD</span>, create a
              matching expense for that date and amount.
            </p>
          </div>
          <div className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-5">
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Rule name
              </span>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-accent/40"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Recurring bill"
                value={form.name}
              />
            </label>
            <div className="sm:col-span-2">
              <AutomationSelectorBuilder
                accounts={accountOptions}
                conditions={form.conditions}
                descriptions={descriptionOptions}
                logic={form.logic_operator}
                matches={previewMatches}
                onChange={(conditions) => setForm((current) => ({ ...current, conditions }))}
                onLogicChange={(logic_operator) => setForm((current) => ({ ...current, logic_operator }))}
              />
            </div>
            <div className="sm:col-span-2"><AutomationActionBuilder actions={form.actions} expenses={expenseTargets} tags={availableTags} onChange={(actions) => setForm((current) => ({ ...current, actions }))} onCreateTag={createTag} /></div>
            {/* Legacy fields are represented by staged Create Expense actions. */}
            {false ? <label className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Create expense
              </span>
              <select
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-accent/40"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    target_budget_item: event.target.value,
                  }))
                }
                required
                value={form.target_budget_item}
              >
                <option value="">Select an expense category</option>
                {expenseTargets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label> : null}
            {false ? <label className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Expense note (optional)
              </span>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-accent/40"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    note_template: event.target.value,
                  }))
                }
                placeholder="Leave blank to use the transaction description"
                value={form.note_template}
              />
            </label> : null}
            {false ? <label
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3 sm:col-span-2"
              title="Deduct created expenses from the credit card total so they are not double counted"
            >
              <input
                checked={form.exclude_from_credit_card}
                className="mt-0.5 size-4 rounded border-white/20 bg-black/20 text-accent focus:ring-accent/40"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    exclude_from_credit_card: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>
                <span className="block text-sm text-white/80">
                  Exclude from credit card
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  When enabled, expense entries created by this rule are
                  deducted from the credit card total.
                </span>
              </span>
            </label> : null}
          </div>
          <div className="border-t border-white/10 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-xl border border-accent/30 bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50"
                disabled={savingForm}
                type="submit"
              >
                {savingForm
                  ? editingRuleId
                    ? "Saving…"
                    : "Creating…"
                  : editingRuleId
                    ? "Save changes"
                    : "Create rule"}
              </button>
              {editingRuleId ? (
                <button
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
                  disabled={savingForm}
                  onClick={closeForm}
                  type="button"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </form>
      ), formHost
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
          rules.map((rule) => (
            <div
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.07] px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:px-5 ${
                editingRuleId === rule.id ? "bg-accent/[0.04]" : ""
              }`}
              key={rule.id}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-white">{rule.name}</p>
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
              <label className="flex items-center gap-2 text-xs text-white/60">
                <input
                  checked={rule.enabled}
                  className="size-4 rounded border-white/20 bg-black/20 text-accent focus:ring-accent/40 disabled:opacity-50"
                  disabled={savingRuleId === rule.id || savingForm}
                  onChange={(event) =>
                    void toggleRule(rule, event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Enabled</span>
              </label>
              <button
                className="justify-self-end rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
                disabled={
                  deletingRuleId === rule.id ||
                  savingForm ||
                  editingRuleId === rule.id
                }
                onClick={() => openEditForm(rule)}
                type="button"
              >
                {editingRuleId === rule.id ? "Editing" : "Edit"}
              </button>
              <button
                className="justify-self-end rounded-md px-2 py-1 text-xs text-rose-200/80 hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
                disabled={deletingRuleId === rule.id || savingForm}
                onClick={() => void deleteRule(rule.id)}
                type="button"
              >
                {deletingRuleId === rule.id ? "Deleting…" : "Delete"}
              </button>
              <div
                className="col-span-full"
                ref={editingRuleId === rule.id ? setFormHost : undefined}
              />
            </div>
          ))
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
