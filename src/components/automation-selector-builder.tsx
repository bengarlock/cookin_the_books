"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import type { ExpenseAutomationCondition } from "@/lib/expense-automation-rule-types";
import type { TransactionSelectorRecord } from "@/lib/credit-card-transaction-types";
import { usePaydayOverrides } from "@/components/payday-overrides";
import { AdjustPaydaysButton } from "@/components/payday-overrides-editor";
import {
  getCurrentPayPeriod,
  localPaydayString,
  parsePaydayDate,
  type PaydayOverrides,
} from "@/lib/pay-cycle";

const pageSize = 10;
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const selectors = [
  { field: "account_last_four", label: "Account", operators: ["equals", "not_equals"] },
  {
    field: "amount",
    label: "Amount",
    operators: [
      "equals",
      "not_equals",
      "greater_than",
      "greater_than_or_equal",
      "less_than",
      "less_than_or_equal",
    ],
  },
  {
    field: "category",
    label: "Category",
    operators: ["equals", "not_equals"],
  },
  {
    field: "description",
    label: "Description",
    operators: [
      "contains",
      "not_contains",
      "equals",
      "not_equals",
      "starts_with",
    ],
  },
  {
    field: "issuer",
    label: "Issuer",
    operators: [
      "contains",
      "not_contains",
      "equals",
      "not_equals",
      "starts_with",
    ],
  },
  {
    field: "tags",
    label: "Tags",
    operators: ["contains", "not_contains", "equals", "not_equals"],
  },
  {
    field: "transaction_date",
    label: "Transaction date",
    operators: ["equals", "not_equals", "on_or_after", "on_or_before"],
  },
  {
    field: "pay_period",
    label: "Pay Period",
    operators: ["equals", "not_equals"],
  },
  {
    field: "transaction_type",
    label: "Transaction type",
    operators: ["equals", "not_equals"],
  },
  {
    field: "transaction_status",
    label: "Transaction status",
    operators: ["equals"],
  },
] as const;

const operatorLabels: Record<string, string> = {
  contains: "Contains",
  not_contains: "Does not contain",
  equals: "Equals",
  not_equals: "Does not equal",
  starts_with: "Starts with",
  greater_than: "Greater than",
  greater_than_or_equal: "Greater than or equal to",
  less_than: "Less than",
  less_than_or_equal: "Less than or equal to",
  on_or_after: "On or after",
  on_or_before: "On or before",
};

function formatPeriodLabel(start: Date, end: Date) {
  return `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`;
}

function payPeriodValue(start: Date, end: Date) {
  return `${localPaydayString(start)}..${localPaydayString(end)}`;
}

function previousPayPeriod(
  periodStart: Date,
  paydayOverrides: PaydayOverrides,
) {
  const previousDay = new Date(periodStart);
  previousDay.setDate(previousDay.getDate() - 1);
  return getCurrentPayPeriod(previousDay, null, paydayOverrides);
}

function getPayPeriodOptions(paydayOverrides: PaydayOverrides) {
  const current = getCurrentPayPeriod(new Date(), null, paydayOverrides);
  const options = [
    {
      value: "current",
      label: `Current (${formatPeriodLabel(current.start, current.end)})`,
    },
  ];
  let period = current;

  for (let index = 0; index < 8; index += 1) {
    period = previousPayPeriod(period.start, paydayOverrides);
    options.push({
      value: payPeriodValue(period.start, period.end),
      label: formatPeriodLabel(period.start, period.end),
    });
  }

  return options;
}

function AccountSelector({
  accounts,
  value,
  onChange,
}: {
  accounts: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [selection, setSelection] = useState(value);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;
      if (!details?.open || details.contains(event.target as Node)) return;
      details.open = false;
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function toggle(account: string) {
    const next = selection.includes(account)
      ? selection.filter((item) => item !== account)
      : [...selection, account];
    setSelection(next);
    onChange(next);
  }

  return (
    <details className="relative" ref={detailsRef}>
      <summary className="cursor-pointer list-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
        {selection.length ? `${selection.length} selected` : "Select accounts"}
      </summary>
      <div className="selector-popover absolute z-20 mt-2 max-h-56 min-w-64 overflow-auto rounded-xl border border-white/15 bg-[#0b1714] p-2 shadow-2xl">
        {accounts.map((account) => (
          <label
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/75 hover:bg-white/[0.05]"
            key={account.value}
          >
            <input
              checked={selection.includes(account.value)}
              onChange={() => toggle(account.value)}
              type="checkbox"
            />
            {account.label}
          </label>
        ))}
      </div>
    </details>
  );
}

function ExistingValueSelector({
  options,
  value,
  onChange,
  label,
}: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(value);
  const selectedKeys = new Set(
    draft.map((item) => item.toLocaleLowerCase()),
  );
  const filtered = options
    .filter((option) => !selectedKeys.has(option.toLocaleLowerCase()))
    .filter(
      (option) =>
        !query.trim() ||
        option.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .slice(0, 50);
  function begin() {
    setDraft(value);
    setQuery("");
    setTextMode(false);
    setOpen(true);
  }
  function apply() {
    const unique = new Map<string, string>();
    draft.map((item) => item.trim()).filter(Boolean).forEach((item) => {
      const key = item.toLocaleLowerCase();
      if (!unique.has(key)) unique.set(key, item);
    });
    onChange(Array.from(unique.values()).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })));
    setOpen(false);
  }
  return (
    <div className="relative">
      <button
        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-white"
        onClick={begin}
        type="button"
      >
        {value.length ? `${value.length} selected` : `Select ${label.toLowerCase()}`}
      </button>
      {open ? (
        <div className="selector-popover absolute right-0 z-30 mt-2 flex max-h-[min(32rem,70vh)] w-full min-w-80 flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0b1714] p-4 shadow-2xl">
          <p className="shrink-0 text-sm font-semibold text-white">
            {draft.length} selected {draft.length === 1 ? "value" : "values"}
          </p>
          {textMode ? (
            <textarea
              autoFocus
              className="mt-3 min-h-32 max-h-[45vh] w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white"
              onChange={(event) => setDraft(event.target.value.split(","))}
              placeholder="Amazon, Home Depot, ShopRite"
              value={draft.join(", ")}
            />
          ) : (
            <>
              <input
                autoFocus
                className="mt-3 w-full shrink-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search existing ${label.toLowerCase()}`}
                value={query}
              />
              {draft.length ? (
                <div className="mt-3 shrink-0 rounded-lg border border-accent/20 bg-accent/[0.06] p-2.5">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                    Selected
                  </p>
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto overscroll-contain">
                    {draft.map((item) => (
                      <button
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-left text-[11px] font-medium text-accent"
                        key={item.toLocaleLowerCase()}
                        onClick={() =>
                          setDraft(
                            draft.filter(
                              (selected) =>
                                selected.toLocaleLowerCase() !==
                                item.toLocaleLowerCase(),
                            ),
                          )
                        }
                        title={`Remove ${item}`}
                        type="button"
                      >
                        <span className="truncate">{item}</span>
                        <span aria-hidden="true" className="shrink-0">×</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="mt-3 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Available
              </p>
              <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {filtered.length ? filtered.map((option) => {
                  return (
                    <button
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/[0.05]"
                      key={option}
                      onClick={() => setDraft([...draft, option])}
                      type="button"
                    >
                      <span className="truncate">{option}</span>
                      <span>+</span>
                    </button>
                  );
                }) : (
                  <p className="px-3 py-4 text-center text-xs text-muted">
                    No available values match this search.
                  </p>
                )}
              </div>
            </>
          )}
          <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-white/10 pt-3">
            <button
              className="text-xs text-accent"
              onClick={() => setTextMode(!textMode)}
              type="button"
            >
              Switch to {textMode ? "search" : "text"} view
            </button>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg border border-accent/30 bg-accent/15 px-3 py-1.5 text-xs text-accent"
                onClick={apply}
                type="button"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PayPeriodSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const paydayOverrides = usePaydayOverrides();
  const options = getPayPeriodOptions(paydayOverrides);
  const selected = value || "current";
  // A saved fixed period may no longer line up with the pay schedule after a
  // payday was moved; keep it selectable instead of showing a blank select.
  const savedRange = selected.split("..");
  const savedStart = parsePaydayDate(savedRange[0]);
  const savedEnd = parsePaydayDate(savedRange[1]);
  if (
    savedStart &&
    savedEnd &&
    !options.some((option) => option.value === selected)
  ) {
    options.push({
      value: selected,
      label: formatPeriodLabel(savedStart, savedEnd),
    });
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <select
        className="min-w-0 flex-[1_1_12rem] rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-sm text-white"
        onChange={(event) => onChange(event.target.value)}
        value={selected}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <AdjustPaydaysButton />
    </div>
  );
}

function TransactionStatusSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-sm text-white"
      onChange={(event) => onChange(event.target.value)}
      value={value || "both"}
    >
      <option value="posted">Posted only</option>
      <option value="pending">Pending only</option>
      <option value="both">Posted + pending</option>
    </select>
  );
}

function CategorySelector({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-sm text-white"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option value="">Select category</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function AutomationSelectorBuilder({
  conditions,
  logic,
  accounts,
  categoryOptions = [],
  descriptions,
  tags,
  matches,
  onChange,
  includeTransactionStatus = false,
  renderConditionFooter,
}: {
  conditions: ExpenseAutomationCondition[];
  logic: "and" | "or";
  accounts: Array<{ value: string; label: string }>;
  categoryOptions?: Array<{ value: string; label: string }>;
  descriptions: string[];
  tags: string[];
  matches: TransactionSelectorRecord[];
  onChange: (conditions: ExpenseAutomationCondition[]) => void;
  includeTransactionStatus?: boolean;
  renderConditionFooter?: (
    condition: ExpenseAutomationCondition,
  ) => ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"selectors" | "matches">("selectors");
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleMatches = matches.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  const availableSelectors = includeTransactionStatus
    ? selectors
    : selectors.filter((selector) => selector.field !== "transaction_status");
  const visibleSelectors = categoryOptions.length
    ? availableSelectors
    : availableSelectors.filter((selector) => selector.field !== "category");

  function addSelector(field: ExpenseAutomationCondition["field"]) {
    const selector = visibleSelectors.find((item) => item.field === field)!;
    onChange([
      ...conditions,
      {
        id: crypto.randomUUID(),
        field,
        operator: selector.operators[0],
        value:
          field === "account_last_four"
            ? []
            : field === "pay_period"
              ? "current"
              : field === "transaction_status"
                ? "both"
              : "",
        logic_operator: conditions.length ? logic : undefined,
      },
    ]);
  }

  function update(id: string, patch: Partial<ExpenseAutomationCondition>) {
    onChange(
      conditions.map((condition) =>
        condition.id === id ? { ...condition, ...patch } : condition,
      ),
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div
        className="min-h-64 rounded-2xl border border-dashed border-white/15 bg-black/10 p-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const field = event.dataTransfer.getData(
            "text/plain",
          ) as ExpenseAutomationCondition["field"];
          if (visibleSelectors.some((item) => item.field === field))
            addSelector(field);
        }}
      >
        <div className="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              Staging area
            </p>
            <div className="mt-2 grid w-full grid-cols-2 gap-1 rounded-lg border border-white/10 p-1 sm:flex sm:w-fit">
              <button
                className={`min-w-0 rounded-md px-2 py-1.5 text-xs sm:px-3 ${tab === "selectors" ? "bg-accent/15 text-accent" : "text-muted"}`}
                onClick={() => setTab("selectors")}
                type="button"
              >
                Selectors
              </button>
              <button
                className={`min-w-0 rounded-md px-2 py-1.5 text-xs sm:px-3 ${tab === "matches" ? "bg-accent/15 text-accent" : "text-muted"}`}
                onClick={() => {
                  setTab("matches");
                  setPage(0);
                }}
                type="button"
              >
                Matching transactions
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100"
              title="Records matching the current selectors"
            >
              <span aria-hidden="true">◉</span>
              <span>{matches.length}</span>
              <span className="font-normal text-sky-100/65">records</span>
            </div>
          </div>
        </div>
        {tab === "selectors" ? (
          conditions.length ? (
            <div className="space-y-3">
              {conditions.map((condition, index) => {
                const selector = selectors.find(
                  (item) => item.field === condition.field,
                )!;
                return (
                  <div
                    className="rounded-xl border border-white/10 bg-white/[0.035] p-3"
                    key={condition.id}
                  >
                    {index ? (
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                          Combine with previous row
                        </span>
                        <div className="flex rounded-lg border border-white/10 p-1">
                          {(["and", "or"] as const).map((connector) => (
                            <button
                              aria-pressed={(condition.logic_operator || logic) === connector}
                              className={`rounded px-2.5 py-1 text-[10px] font-semibold uppercase ${
                                (condition.logic_operator || logic) === connector
                                  ? "bg-accent/15 text-accent"
                                  : "text-muted"
                              }`}
                              key={connector}
                              onClick={() =>
                                update(condition.id, {
                                  logic_operator: connector,
                                })
                              }
                              type="button"
                            >
                              {connector}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_minmax(10rem,1fr)_auto]">
                      <span className="text-sm font-medium text-white">
                        {selector.label}
                      </span>
                      <select
                        className="condition-operator rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-xs text-white"
                        value={condition.operator}
                        onChange={(event) =>
                          update(condition.id, {
                            operator: event.target
                              .value as ExpenseAutomationCondition["operator"],
                          })
                        }
                      >
                        {selector.operators.map((operator) => (
                          <option key={operator} value={operator}>
                            {operatorLabels[operator]}
                          </option>
                        ))}
                      </select>
                      {condition.field === "account_last_four" ? (
                        <AccountSelector
                          accounts={accounts}
                          onChange={(value) => update(condition.id, { value })}
                          value={
                            Array.isArray(condition.value)
                              ? condition.value
                              : []
                          }
                        />
                      ) : condition.field === "category" ? (
                        <CategorySelector
                          onChange={(value) => update(condition.id, { value })}
                          options={categoryOptions}
                          value={
                            Array.isArray(condition.value)
                              ? condition.value[0] || ""
                              : condition.value
                          }
                        />
                      ) : condition.field === "description" || condition.field === "tags" ? (
                        <ExistingValueSelector
                          label={condition.field === "tags" ? "Tags" : "Descriptions"}
                          onChange={(value) => update(condition.id, { value })}
                          options={condition.field === "tags" ? tags : descriptions}
                          value={
                            Array.isArray(condition.value)
                              ? condition.value
                              : condition.value
                                ? [condition.value]
                                : []
                          }
                        />
                      ) : condition.field === "pay_period" ? (
                        <PayPeriodSelector
                          onChange={(value) => update(condition.id, { value })}
                          value={
                            Array.isArray(condition.value)
                              ? condition.value[0] || "current"
                            : condition.value || "current"
                          }
                        />
                      ) : condition.field === "transaction_status" ? (
                        <TransactionStatusSelector
                          onChange={(value) =>
                            update(condition.id, { value })
                          }
                          value={
                            Array.isArray(condition.value)
                              ? condition.value[0] || "both"
                              : condition.value || "both"
                          }
                        />
                      ) : (
                        <input
                          className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-accent/40"
                          onChange={(event) =>
                            update(condition.id, { value: event.target.value })
                          }
                          placeholder={
                            condition.field === "transaction_date"
                              ? "YYYY-MM-DD"
                              : "Value"
                          }
                          type={
                            condition.field === "amount"
                              ? "number"
                              : condition.field === "transaction_date"
                                ? "date"
                                : "text"
                          }
                          value={condition.value as string}
                        />
                      )}
                      <button
                        aria-label={`Remove ${selector.label}`}
                        className="px-2 text-lg text-white/35 hover:text-rose-200"
                        onClick={() =>
                          onChange(
                            conditions.filter(
                              (item) => item.id !== condition.id,
                            ),
                          )
                        }
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                    {renderConditionFooter?.(condition)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-44 place-items-center rounded-xl border border-white/[0.06] text-center text-sm text-muted">
              Drop a selector here to begin.
            </div>
          )
        ) : (
          <div>
            <div className="space-y-2">
              {visibleMatches.map((transaction) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                  key={transaction.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white/80">
                      {transaction.description}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {dateFormatter.format(
                        new Date(`${transaction.transaction_date}T12:00:00`),
                      )}{" "}
                      · {transaction.issuer} ••••{" "}
                      {transaction.account_last_four}
                    </p>
                    {transaction.tags?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {transaction.tags.map((tag) => (
                          <span
                            className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium text-sky-100"
                            key={tag.id}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="whitespace-nowrap font-mono text-sm text-white">
                    {currencyFormatter.format(Number(transaction.amount))}
                  </span>
                </div>
              ))}
              {!matches.length ? (
                <div className="grid min-h-44 place-items-center rounded-xl border border-white/[0.06] text-sm text-muted">
                  No transactions match the current selectors.
                </div>
              ) : null}
            </div>
            {matches.length ? (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted">
                  Showing {currentPage * pageSize + 1}–
                  {Math.min((currentPage + 1) * pageSize, matches.length)} of{" "}
                  {matches.length}
                </p>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white disabled:opacity-30"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                    type="button"
                  >
                    Previous
                  </button>
                  <span className="px-2 py-1.5 text-xs text-muted">
                    Page {currentPage + 1} of {pageCount}
                  </span>
                  <button
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white disabled:opacity-30"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage(currentPage + 1)}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
      <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold">
          Selectors
        </p>
        <input
          className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search selectors"
          value={search}
        />
        <div className="mt-3 space-y-1">
              {visibleSelectors
            .filter((item) =>
              item.label.toLowerCase().includes(search.toLowerCase()),
            )
            .map((selector) => (
              <button
                className="flex w-full cursor-grab items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/70 transition hover:bg-accent/10 hover:text-accent"
                draggable
                key={selector.field}
                onClick={() => addSelector(selector.field)}
                onDragStart={(event) =>
                  event.dataTransfer.setData("text/plain", selector.field)
                }
                type="button"
              >
                <span aria-hidden="true">⠿</span>
                {selector.label}
              </button>
            ))}
        </div>
      </aside>
    </div>
  );
}
