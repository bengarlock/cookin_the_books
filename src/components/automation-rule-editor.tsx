"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AutomationActionBuilder } from "@/components/automation-action-builder";
import { AutomationSelectorBuilder } from "@/components/automation-selector-builder";
import { APP_BASE_PATH } from "@/lib/config";
import type { BudgetItem } from "@/lib/budget-item-types";
import type { ExpenseCategory } from "@/lib/expense-category-types";
import type {
  CreditCardTransaction,
  ExpenseTag,
} from "@/lib/credit-card-transaction-types";
import type {
  ExpenseAutomationAction,
  ExpenseAutomationCondition,
  ExpenseAutomationMatchField,
  ExpenseAutomationMatchOperator,
  ExpenseAutomationRule,
} from "@/lib/expense-automation-rule-types";
import {
  conditionIsEmpty,
  selectTransactions,
} from "@/lib/transaction-selector";

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
    conditions: (rule.conditions?.length
      ? rule.conditions
      : [
          {
            id: crypto.randomUUID(),
            field: rule.match_field,
            operator: rule.match_operator,
            value: rule.match_value,
          },
        ]).map((condition) => ({
      ...condition,
      id: condition.id || crypto.randomUUID(),
    })),
    actions: (rule.actions?.length
      ? rule.actions
      : rule.target_budget_item
        ? [
            {
              type: "create_expense" as const,
              budget_item: String(rule.target_budget_item),
              note: rule.note_template,
              exclude_from_credit_card: rule.exclude_from_credit_card,
            },
          ]
        : []
    ).map((action) => ({
      ...action,
      budget_item:
        action.type === "create_expense" ? String(action.budget_item) : undefined,
      id: crypto.randomUUID(),
    })) as ExpenseAutomationAction[],
    logic_operator: rule.logic_operator || "and",
  };
}

function serializeAction(
  action: ExpenseAutomationAction,
): ExpenseAutomationRule["actions"][number] {
  if (action.type === "create_expense") {
    return {
      type: action.type,
      budget_item: action.budget_item,
      note: action.note,
      exclude_from_credit_card: action.exclude_from_credit_card,
    };
  }
  if (action.type === "assign_tag") {
    return { type: action.type, tag: action.tag };
  }
  if (action.type === "assign_category") {
    return {
      type: action.type,
      category: action.category,
      category_label: action.category_label,
    };
  }
  return {
    type: action.type,
    split: action.split,
    include: action.include,
  };
}

export function AutomationRuleEditor({
  cancelHref,
  displayName,
  initialBudgetItems,
  initialCategories,
  initialCreditCardTransactions,
  initialRule,
  initialTags,
  onCancel,
  onSaved,
  showNameField = true,
}: {
  cancelHref?: string;
  displayName?: string;
  initialBudgetItems: BudgetItem[];
  initialCategories: ExpenseCategory[];
  initialCreditCardTransactions: CreditCardTransaction[];
  initialRule?: ExpenseAutomationRule;
  initialTags: ExpenseTag[];
  onCancel?: () => void;
  onSaved?: (rule: ExpenseAutomationRule) => void;
  showNameField?: boolean;
}) {
  const router = useRouter();
  const editingRuleId = initialRule?.id ?? null;
  const [form, setForm] = useState(() =>
    initialRule ? ruleToForm(initialRule) : emptyRuleForm,
  );
  const [savingForm, setSavingForm] = useState(false);
  const [error, setError] = useState("");
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
    return Array.from(accounts, ([value, label]) => ({ value, label })).sort(
      (a, b) => a.label.localeCompare(b.label),
    );
  }, [initialCreditCardTransactions]);
  const descriptionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          initialCreditCardTransactions
            .map((transaction) => transaction.description)
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [initialCreditCardTransactions],
  );

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

  const previewMatches = useMemo(() => {
    if (!form.conditions.length || form.conditions.some(conditionIsEmpty)) {
      return [];
    }
    const activeRuleName = showNameField
      ? form.name
      : displayName || form.name;

    const draftRule: ExpenseAutomationRule = {
      id: editingRuleId || 0,
      name: activeRuleName || "Draft rule",
      enabled: initialRule?.enabled ?? true,
      match_field: form.match_field,
      match_operator: form.match_operator,
      match_value: form.match_value.trim(),
      target_budget_item: Number(form.target_budget_item) || 0,
      note_template: form.note_template,
      exclude_from_credit_card: form.exclude_from_credit_card,
      created_at: initialRule?.created_at ?? "",
      updated_at: initialRule?.updated_at ?? "",
      conditions: form.conditions,
      actions: form.actions.map(serializeAction),
      logic_operator: form.logic_operator,
    };

    return selectTransactions(
      initialCreditCardTransactions,
      draftRule.conditions,
      draftRule.logic_operator,
    );
  }, [
    displayName,
    editingRuleId,
    form,
    initialCreditCardTransactions,
    initialRule,
    showNameField,
  ]);

  function cancelForm() {
    setError("");
    onCancel?.();
  }

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const activeRuleName = showNameField
      ? form.name.trim()
      : (displayName || form.name).trim();
    if (
      !activeRuleName ||
      !form.conditions.length ||
      form.conditions.some(conditionIsEmpty) ||
      !form.actions.length ||
      form.actions.some((action) =>
        action.type === "create_expense"
          ? !action.budget_item
          : action.type === "assign_tag"
            ? !action.tag.trim()
            : action.type === "assign_category"
              ? !action.category
              : false,
      )
    ) {
      setError("Enter a rule name, selector, and action.");
      return;
    }

    const firstCondition = form.conditions[0];
    const compatibilityField = [
      "description",
      "issuer",
      "transaction_type",
    ].includes(firstCondition.field)
      ? (firstCondition.field as ExpenseAutomationMatchField)
      : "description";
    const compatibilityOperator = ["contains", "equals"].includes(
      firstCondition.operator,
    )
      ? (firstCondition.operator as ExpenseAutomationMatchOperator)
      : "contains";
    const compatibilityValue = Array.isArray(firstCondition.value)
      ? firstCondition.value.join(",")
      : firstCondition.value;
    const payload = {
      name: activeRuleName,
      match_field: compatibilityField,
      match_operator: compatibilityOperator,
      match_value: compatibilityValue,
      target_budget_item:
        form.actions.find((action) => action.type === "create_expense")
          ?.budget_item || null,
      note_template: form.note_template.trim(),
      exclude_from_credit_card: form.exclude_from_credit_card,
      conditions: form.conditions.map(
        ({ field, logic_operator, operator, value }, index) => ({
          field,
          operator,
          value,
          ...(index ? { logic_operator: logic_operator || form.logic_operator } : {}),
        }),
      ),
      logic_operator: form.logic_operator,
      actions: form.actions.map(serializeAction),
    };

    setSavingForm(true);
    setError("");
    let navigatingAway = false;
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

      onSaved?.(saved);
      if (!editingRuleId) {
        setForm(emptyRuleForm);
      }
      if (cancelHref) {
        navigatingAway = true;
        router.push(cancelHref);
        router.refresh();
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : editingRuleId
            ? "Unable to update the automation rule."
            : "Unable to create the automation rule.",
      );
    } finally {
      if (!navigatingAway) {
        setSavingForm(false);
      }
    }
  }

  const saveButtonLabel = savingForm
    ? editingRuleId
      ? "Saving..."
      : "Creating..."
    : editingRuleId
      ? "Save changes"
      : "Create rule";
  const cancelControl = cancelHref ? (
    <Link
      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.08]"
      href={cancelHref}
    >
      Cancel
    </Link>
  ) : onCancel ? (
    <button
      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
      disabled={savingForm}
      onClick={cancelForm}
      type="button"
    >
      Cancel
    </button>
  ) : null;

  return (
    <form
      className="surface overflow-visible rounded-2xl"
      onSubmit={(event) => void saveRule(event)}
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.045] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">
            {editingRuleId ? "Edit rule" : "Create rule"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Example: when a transaction description contains{" "}
            <span className="text-white/80">MERCHANT KEYWORD</span>, create a
            matching expense for that date and amount.
          </p>
        </div>
        <button
          className="inline-flex min-w-[8.5rem] shrink-0 items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-70"
          disabled={savingForm}
          type="submit"
        >
          {savingForm ? (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
            />
          ) : null}
          {saveButtonLabel}
        </button>
      </div>

      {error ? (
        <p
          className="mx-4 mt-4 rounded-xl border border-rose-300/15 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 sm:mx-5"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-5">
        {showNameField ? (
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
        ) : null}
        <div className="sm:col-span-2">
          <AutomationSelectorBuilder
            accounts={accountOptions}
            conditions={form.conditions}
            descriptions={descriptionOptions}
            tags={availableTags}
            logic={form.logic_operator}
            matches={previewMatches}
            onChange={(conditions) =>
              setForm((current) => ({ ...current, conditions }))
            }
          />
        </div>
        <div className="sm:col-span-2">
          <AutomationActionBuilder
            actions={form.actions}
            categories={initialCategories}
            expenses={expenseTargets}
            tags={availableTags}
            onChange={(actions) =>
              setForm((current) => ({ ...current, actions }))
            }
            onCreateTag={createTag}
          />
        </div>
      </div>
      {cancelControl ? (
        <div className="border-t border-white/10 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap gap-3">
            {cancelControl}
          </div>
        </div>
      ) : null}
    </form>
  );
}
