"use client";

import { FormEvent, useMemo, useState } from "react";

import type { BudgetItem } from "@/lib/budget-item-types";
import type {
  ExpenseAutomationCondition,
  ExpenseAutomationMatchField,
  ExpenseAutomationMatchOperator,
  ExpenseAutomationRule,
  ExpenseAutomationRunResult,
} from "@/lib/expense-automation-rule-types";
import { AutomationSelectorBuilder } from "@/components/automation-selector-builder";
import type { CreditCardTransaction } from "@/lib/credit-card-transaction-types";
import { extractApiErrorDetail, extractApiErrorMessage } from "@/lib/api-error-message";
import { APP_BASE_PATH } from "@/lib/config";
import { formatAutomationRunMessage } from "@/lib/format-automation-run-message";
import type { ExpenseCategoryRule } from "@/lib/expense-category-rule-types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const matchFieldLabels: Record<ExpenseAutomationMatchField, string> = {
  description: "description",
  issuer: "issuer",
  transaction_type: "transaction type",
};

const matchOperatorLabels: Record<ExpenseAutomationMatchOperator, string> = {
  contains: "contains",
  equals: "equals",
};

const emptyRuleForm = {
  name: "",
  match_field: "description" as ExpenseAutomationMatchField,
  match_operator: "contains" as ExpenseAutomationMatchOperator,
  match_value: "",
  target_budget_item: "",
  note_template: "",
  exclude_from_credit_card: true,
  conditions: [] as ExpenseAutomationCondition[],
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
    logic_operator: rule.logic_operator || "and",
  };
}

function formatCurrency(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number) ? currencyFormatter.format(number) : "—";
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00`));
}

function ruleSummary(
  rule: ExpenseAutomationRule,
  budgetItemsById: Map<number, BudgetItem>,
) {
  const target = budgetItemsById.get(rule.target_budget_item)?.label || "Expense";
  return `When ${matchFieldLabels[rule.match_field]} ${matchOperatorLabels[rule.match_operator]} "${rule.match_value}", create ${target}`;
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
  const value = fieldValue.toLowerCase();
  const target = String(condition.value).toLowerCase();
  if (condition.operator === "contains") return value.includes(target);
  if (condition.operator === "not_contains") return !value.includes(target);
  if (condition.operator === "equals") return value === target;
  if (condition.operator === "not_equals") return value !== target;
  if (condition.operator === "starts_with") return value.startsWith(target);
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
  initialCategoryRules,
}: {
  initialBudgetItems: BudgetItem[];
  initialCreditCardTransactions: CreditCardTransaction[];
  initialRules: ExpenseAutomationRule[];
  initialCategoryRules: ExpenseCategoryRule[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [categoryRules, setCategoryRules] = useState(initialCategoryRules);
  const [editingCategoryRuleId, setEditingCategoryRuleId] = useState<number | null>(null);
  const [savingCategoryRuleId, setSavingCategoryRuleId] = useState<number | null>(null);
  const [deletingCategoryRuleId, setDeletingCategoryRuleId] = useState<number | null>(null);
  const [confirmingCategoryRuleId, setConfirmingCategoryRuleId] = useState<number | null>(null);
  const [runningCategoryRules, setRunningCategoryRules] = useState(false);
  const [categoryRuleMessage, setCategoryRuleMessage] = useState("");
  const [categoryRuleForm, setCategoryRuleForm] = useState({
    display_description: "",
    match_type: "exact" as "exact" | "starts_with",
    category: "other",
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyRuleForm);
  const [savingForm, setSavingForm] = useState(false);
  const [running, setRunning] = useState(false);
  const [savingRuleId, setSavingRuleId] = useState<number | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [runMessage, setRunMessage] = useState("");

  const categoryLabels: Record<string, string> = {
    dining: "Dining", groceries: "Groceries", transportation: "Transportation",
    housing: "Housing", utilities: "Utilities", shopping: "Shopping", health: "Health",
    entertainment: "Entertainment", travel: "Travel", subscriptions: "Subscriptions",
    fees_interest: "Fees & interest", other: "Other",
  };

  function editCategoryRule(rule: ExpenseCategoryRule) {
    setEditingCategoryRuleId(rule.id);
    setCategoryRuleForm({
      display_description: rule.display_description,
      match_type: rule.match_type,
      category: rule.category,
    });
    setError("");
  }

  async function saveCategoryRule(ruleId: number) {
    setSavingCategoryRuleId(ruleId);
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/expense-category-rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryRuleForm),
      });
      const saved = await response.json().catch(() => null) as ExpenseCategoryRule | { message?: string } | null;
      if (!response.ok || !saved || !("id" in saved)) throw new Error(saved && "message" in saved ? saved.message : "Unable to update the category rule.");
      setCategoryRules((current) => current.map((rule) => rule.id === saved.id ? saved : rule));
      setEditingCategoryRuleId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update the category rule.");
    } finally {
      setSavingCategoryRuleId(null);
    }
  }

  async function deleteCategoryRule(ruleId: number) {
    setDeletingCategoryRuleId(ruleId);
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/expense-category-rules/${ruleId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete the category rule.");
      setCategoryRules((current) => current.filter((rule) => rule.id !== ruleId));
      setConfirmingCategoryRuleId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete the category rule.");
    } finally {
      setDeletingCategoryRuleId(null);
    }
  }

  async function runCategoryRules() {
    setRunningCategoryRules(true);
    setError("");
    setCategoryRuleMessage("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/expense-category-rules/run`, { method: "POST" });
      const result = await response.json().catch(() => null) as { updated_count?: number; message?: string } | null;
      if (!response.ok) throw new Error(result?.message || "Unable to run category rules.");
      setCategoryRuleMessage(`Updated ${result?.updated_count || 0} existing transactions.`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run category rules.");
    } finally {
      setRunningCategoryRules(false);
    }
  }

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
      if (transaction.account_last_four) {
        accounts.set(
          transaction.account_last_four,
          `${transaction.issuer} •••• ${transaction.account_last_four}`,
        );
      }
    });
    return Array.from(accounts, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [initialCreditCardTransactions]);

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
      logic_operator: form.logic_operator,
    };

    return initialCreditCardTransactions
      .filter((transaction) => {
        const results = draftRule.conditions.map((condition) => transactionMatchesCondition(transaction, condition));
        return draftRule.logic_operator === "or" ? results.some(Boolean) : results.every(Boolean);
      })
      .slice(0, 5);
  }, [form, initialCreditCardTransactions]);

  function openCreateForm() {
    setEditingRuleId(null);
    setForm(emptyRuleForm);
    setFormOpen(true);
    setError("");
  }

  function openEditForm(rule: ExpenseAutomationRule) {
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
    const targetBudgetItem = Number(form.target_budget_item);
    if (
      !form.name.trim() ||
      !form.conditions.length || form.conditions.some(conditionIsEmpty) ||
      !Number.isFinite(targetBudgetItem)
    ) {
      setError("Enter a rule name, match text, and target expense.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      match_field: form.match_field,
      match_operator: form.match_operator,
      match_value: form.match_value.trim(),
      target_budget_item: targetBudgetItem,
      note_template: form.note_template.trim(),
      exclude_from_credit_card: form.exclude_from_credit_card,
      conditions: form.conditions.map(({ field, operator, value }) => ({ field, operator, value })),
      logic_operator: form.logic_operator,
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
      if (!response.ok || !result || !("created_count" in result)) {
        const fallback = "Unable to run automation rules.";
        const message = extractApiErrorMessage(result, fallback);
        const detail = extractApiErrorDetail(result);
        throw new Error(detail ? `${message} (${detail})` : message);
      }
      setRunMessage(
        formatAutomationRunMessage({
          created_count: result.created_count,
          skipped_duplicate_count: result.skipped_duplicate_count ?? 0,
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
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Category rules
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Categorize matching card transactions before AI classification. Rules learned from corrections appear here too.
          </p>
          </div>
          <button className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:border-accent/25 hover:bg-accent/10 disabled:opacity-50" disabled={runningCategoryRules || !categoryRules.length} onClick={() => void runCategoryRules()} type="button">{runningCategoryRules ? "Running…" : "Run category rules now"}</button>
        </div>
        {categoryRuleMessage ? <p className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent" role="status">{categoryRuleMessage}</p> : null}
        <div className="surface overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
            <h2 className="text-sm font-semibold text-white">Active category rules</h2>
            <p className="mt-1 text-xs text-muted">{categoryRules.length} {categoryRules.length === 1 ? "rule" : "rules"}</p>
          </div>
          {categoryRules.length ? <div className="divide-y divide-white/[0.07]">
            {categoryRules.map((rule) => <div className="px-4 py-4 sm:px-5" key={rule.id}>
              {editingCategoryRuleId === rule.id ? <div className="grid items-center gap-3 sm:grid-cols-[auto_minmax(12rem,1fr)_auto_auto_auto]">
                <select aria-label="Match condition" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" value={categoryRuleForm.match_type} onChange={(event) => setCategoryRuleForm((current) => ({ ...current, match_type: event.target.value as "exact" | "starts_with" }))}><option value="exact">Equals</option><option value="starts_with">Starts with</option></select>
                <input aria-label="Match value" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-accent/40" placeholder="AMAZON" value={categoryRuleForm.display_description} onChange={(event) => setCategoryRuleForm((current) => ({ ...current, display_description: event.target.value }))} />
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Set category</span>
                <select aria-label="Set category" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" value={categoryRuleForm.category} onChange={(event) => setCategoryRuleForm((current) => ({ ...current, category: event.target.value }))}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <div className="flex gap-2"><button className="rounded-lg bg-accent/15 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50" disabled={savingCategoryRuleId === rule.id} onClick={() => void saveCategoryRule(rule.id)} type="button">{savingCategoryRuleId === rule.id ? "Saving…" : "Save"}</button><button className="px-2 text-xs text-muted hover:text-white" onClick={() => setEditingCategoryRuleId(null)} type="button">Cancel</button></div>
              </div> : <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                <p className="text-sm font-semibold text-white">{rule.display_description}</p>
                <p className="mt-1 text-xs text-muted">
                  Description {rule.match_type === "starts_with" ? "starts with" : "equals"} “{rule.normalized_description}”
                </p>
                </div>
                <div className="flex items-center gap-3"><span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{categoryLabels[rule.category] || rule.category}</span><button className="text-xs font-medium text-white/55 hover:text-accent" onClick={() => editCategoryRule(rule)} type="button">Edit</button>{confirmingCategoryRuleId === rule.id ? <><button className="text-xs font-semibold text-rose-200" disabled={deletingCategoryRuleId === rule.id} onClick={() => void deleteCategoryRule(rule.id)} type="button">{deletingCategoryRuleId === rule.id ? "Deleting…" : "Confirm delete"}</button><button className="text-xs text-muted hover:text-white" onClick={() => setConfirmingCategoryRuleId(null)} type="button">Cancel</button></> : <button className="text-xs font-medium text-rose-200/70 hover:text-rose-100" onClick={() => setConfirmingCategoryRuleId(rule.id)} type="button">Delete</button>}</div>
              </div>}
            </div>)}
          </div> : <p className="px-5 py-8 text-center text-sm text-muted">No category rules yet.</p>}
        </div>
      </section>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Transaction rules
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Match imported credit-card transactions and automatically create
            expense entries. Rules also run when new statements are imported.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:border-accent/25 hover:bg-accent/10"
            disabled={running}
            onClick={() => void runRules()}
            type="button"
          >
            {running ? "Running…" : "Run rules now"}
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
                logic={form.logic_operator}
                matchCount={previewMatches.length}
                onChange={(conditions) => setForm((current) => ({ ...current, conditions }))}
                onLogicChange={(logic_operator) => setForm((current) => ({ ...current, logic_operator }))}
              />
            </div>
            <label className="sm:col-span-2">
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
            </label>
            <label className="sm:col-span-2">
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
            </label>
            <label
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
            </label>
          </div>
          {previewMatches.length ? (
            <div className="border-t border-white/10 px-4 py-4 sm:px-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Matching transactions
              </p>
              <div className="mt-3 space-y-2">
                {previewMatches.map((transaction) => (
                  <div
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                    key={transaction.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white/80">
                        {transaction.description}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatDate(transaction.transaction_date)} ·{" "}
                        {transaction.issuer}
                      </p>
                    </div>
                    <span className="whitespace-nowrap font-mono text-sm text-white">
                      {formatCurrency(transaction.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : form.match_value.trim() ? (
            <p className="border-t border-white/10 px-4 py-4 text-sm text-muted sm:px-5">
              No imported transactions match this rule yet.
            </p>
          ) : null}
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
                  {ruleSummary(rule, budgetItemsById)}
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
