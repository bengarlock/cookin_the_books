"use client";

import { FormEvent, useMemo, useState } from "react";

import { DateRangePicker } from "@/components/date-range-picker";
import { APP_BASE_PATH } from "@/lib/config";
import { cashAccountIncomeTransactions } from "@/lib/cash-account-ledgers";
import type { IncomeTransaction } from "@/lib/credit-card-transaction-types";
import {
  defaultExpenseDateRange,
  formatExpenseDateRange,
  type ExpenseDateRange,
} from "@/lib/expense-date-range";
import type { IncomeEntry } from "@/lib/income-entry-types";
import {
  incomeLedgerTotals,
  reconcileSyncedIncome,
} from "@/lib/income-reconciliation";
import { validatePdfImportFiles } from "@/lib/pdf-import";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function todayString() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00`));
}

function money(value: string | number | null | undefined) {
  return currencyFormatter.format(Number(value || 0));
}

function breakdownEntries(
  breakdown: Record<string, string> | undefined,
  {
    excludeLabels = [],
    onlyNegative = false,
  }: { excludeLabels?: string[]; onlyNegative?: boolean } = {},
) {
  const excluded = new Set(excludeLabels.map((label) => label.toLowerCase()));
  return Object.entries(breakdown || {})
    .filter(([label]) => !excluded.has(label.toLowerCase()))
    .filter(([, value]) => !onlyNegative || Number(value) < 0)
    .map(([label, value]) => [label, Math.abs(Number(value))] as const)
    .filter(([, value]) => value > 0)
    .sort(([leftLabel], [rightLabel]) => leftLabel.localeCompare(rightLabel));
}

function sumBreakdown(
  breakdown: Record<string, string> | undefined,
  options?: { excludeLabels?: string[]; onlyNegative?: boolean },
) {
  return breakdownEntries(breakdown, options).reduce(
    (total, [, value]) => total + value,
    0,
  );
}

type MoneyBreakdownEntry = readonly [
  label: string,
  value: number,
  formatter?: (value: number) => string,
];

function MoneyHoverCard({
  entries,
  label,
  total,
  className = "",
  valueClassName = "",
}: {
  entries: MoneyBreakdownEntry[];
  label: string;
  total: number;
  className?: string;
  valueClassName?: string;
}) {
  if (!entries.length) {
    return <span className={className}>{money(total)}</span>;
  }

  return (
    <span className={`group relative inline-flex justify-end ${className}`}>
      <button
        aria-label={`Show ${label.toLowerCase()} breakdown`}
        className={`rounded-md border border-transparent px-1 text-right font-mono text-inherit underline decoration-white/20 underline-offset-4 outline-none transition hover:border-current/20 hover:bg-white/5 focus:border-current/30 focus:bg-white/5 ${valueClassName}`}
        type="button"
      >
        {money(total)}
      </button>
      <span className="themed-popover pointer-events-none absolute right-0 top-full z-30 mt-2 hidden w-72 rounded-xl border border-white/15 bg-[#081811] p-3 text-left text-current shadow-2xl shadow-black/40 group-hover:block group-focus-within:block">
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
          {label} breakdown
        </span>
        <span className="block space-y-1">
          {entries.map(([label, value, formatter]) => (
            <span
              className="flex items-center justify-between gap-4 text-xs opacity-85"
              key={label}
            >
              <span className="truncate">{label}</span>
              <span className="font-mono text-current">
                {formatter ? formatter(value) : money(value)}
              </span>
            </span>
          ))}
        </span>
        <span className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-xs font-semibold">
          <span>Total</span>
          <span className="font-mono text-current">{money(total)}</span>
        </span>
      </span>
    </span>
  );
}

function statementEntries(
  entries: IncomeEntry[],
  valueSelector: (entry: IncomeEntry) => number,
) {
  return entries
    .map((entry) => {
      return [
        formatDate(entry.pay_date),
        valueSelector(entry),
      ] as MoneyBreakdownEntry;
    })
    .filter(([, value]) => Math.abs(value) > 0);
}

export function IncomeHistory({
  initialIncomeEntries,
  initialIncomeTransactions,
}: {
  initialIncomeEntries: IncomeEntry[];
  initialIncomeTransactions: IncomeTransaction[];
}) {
  const [entries, setEntries] = useState(initialIncomeEntries);
  const [incomeTransactions, setIncomeTransactions] = useState(
    initialIncomeTransactions,
  );
  const [dateRange, setDateRange] = useState<ExpenseDateRange>(
    defaultExpenseDateRange(),
  );
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [savingIncludeId, setSavingIncludeId] = useState<number | null>(null);
  const [form, setForm] = useState({
    employer: "",
    periodStart: todayString(),
    periodEnd: todayString(),
    payDate: todayString(),
    grossPay: "",
    netPay: "",
  });

  const filteredEntries = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            entry.pay_date >= dateRange.start && entry.pay_date <= dateRange.end,
        )
        .sort(
          (left, right) =>
            right.pay_date.localeCompare(left.pay_date) || right.id - left.id,
        ),
    [dateRange.end, dateRange.start, entries],
  );
  const reconciledIncome = useMemo(
    () =>
      reconcileSyncedIncome(
        entries,
        cashAccountIncomeTransactions(incomeTransactions, {
          includeExcluded: true,
        }),
      ),
    [entries, incomeTransactions],
  );
  const syncedIncomeByEntryId = useMemo(
    () =>
      new Map(
        reconciledIncome.matches.map(({ incomeEntry, transaction }) => [
          incomeEntry.id,
          transaction,
        ]),
      ),
    [reconciledIncome.matches],
  );
  const syncedAccountIncome = useMemo(
    () =>
      reconciledIncome.unmatchedTransactions
        .filter(
          (transaction) =>
            transaction.transaction_date >= dateRange.start &&
            transaction.transaction_date <= dateRange.end,
        )
        .sort(
          (left, right) =>
            right.transaction_date.localeCompare(left.transaction_date) ||
            right.id - left.id,
        ),
    [dateRange.end, dateRange.start, reconciledIncome.unmatchedTransactions],
  );
  const syncedAccountIncomeTotal = syncedAccountIncome.reduce(
    (total, transaction) =>
      total + (transaction.include ? Number(transaction.amount) : 0),
    0,
  );
  const ledgerTotals = incomeLedgerTotals(
    entries,
    cashAccountIncomeTransactions(incomeTransactions, {
      includeExcluded: true,
    }),
    dateRange,
  );
  const totalGross = ledgerTotals.gross;
  const totalNet = ledgerTotals.net;
  const statementNet = filteredEntries.reduce(
    (total, entry) => total + Number(entry.net_pay),
    0,
  );
  const totalTaxes = filteredEntries.reduce((total, entry) => {
    return total + sumBreakdown(entry.breakdown?.taxes, { onlyNegative: true });
  }, 0);
  const totalDeductions = totalGross - totalTaxes - totalNet;
  const taxBreakdown = filteredEntries.reduce<Record<string, number>>(
    (breakdown, entry) => {
      for (const [label, value] of breakdownEntries(entry.breakdown?.taxes, {
        onlyNegative: true,
      })) {
        breakdown[label] = (breakdown[label] || 0) + value;
      }
      return breakdown;
    },
    {},
  );
  const taxBreakdownEntries = Object.entries(taxBreakdown).sort(
    ([leftLabel], [rightLabel]) => leftLabel.localeCompare(rightLabel),
  );
  const deductionBreakdown = filteredEntries.reduce<Record<string, number>>(
    (breakdown, entry) => {
      const knownDeductions = breakdownEntries(entry.breakdown?.deductions, {
        excludeLabels: ["Cell"],
        onlyNegative: true,
      });
      const knownTotal = knownDeductions.reduce(
        (total, [, value]) => total + value,
        0,
      );
      const entryTaxes = sumBreakdown(entry.breakdown?.taxes, {
        onlyNegative: true,
      });
      const reconciledTotal =
        Number(entry.gross_pay) - entryTaxes - Number(entry.net_pay);
      const adjustment = reconciledTotal - knownTotal;

      for (const [label, value] of knownDeductions) {
        breakdown[label] = (breakdown[label] || 0) + value;
      }
      if (Math.abs(adjustment) >= 0.01) {
        const label =
          adjustment > 0
            ? "Uncategorized payroll adjustment"
            : "Payroll credit / reimbursement";
        breakdown[label] = (breakdown[label] || 0) + adjustment;
      }
      return breakdown;
    },
    {},
  );
  const deductionBreakdownEntries = Object.entries(deductionBreakdown).sort(
    ([leftLabel], [rightLabel]) => leftLabel.localeCompare(rightLabel),
  );
  const grossStatementEntries = statementEntries(filteredEntries, (entry) =>
    Number(entry.gross_pay),
  ).concat(
    ledgerTotals.syncedInRange.map((transaction) => [
      `${formatDate(transaction.transaction_date)} · ${transaction.description}`,
      Number(transaction.amount),
    ] as MoneyBreakdownEntry),
  );
  const netStatementEntries = statementEntries(filteredEntries, (entry) =>
    Number(entry.net_pay),
  ).concat(
    ledgerTotals.syncedInRange.map((transaction) => [
      `${formatDate(transaction.transaction_date)} · ${transaction.description}`,
      Number(transaction.amount),
    ] as MoneyBreakdownEntry),
  );
  const averageNetEntries = filteredEntries.length
    ? ([
        ["Statement net income", statementNet],
        [
          "Pay statements",
          filteredEntries.length,
          (value: number) => `${value} statement${value === 1 ? "" : "s"}`,
        ],
      ] as MoneyBreakdownEntry[])
    : [];
  const averageNet = filteredEntries.length
    ? statementNet / filteredEntries.length
    : 0;

  async function toggleSyncedIncomeInclude(
    transaction: IncomeTransaction,
  ) {
    setSavingIncludeId(transaction.id);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/update-budget-flags?include_unbudgeted=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ include: !transaction.include }),
        },
      );
      const updated = (await response.json().catch(() => null)) as
        | IncomeTransaction
        | { message?: string }
        | null;
      if (!response.ok || !updated || !("id" in updated)) {
        throw new Error(
          updated && "message" in updated && updated.message
            ? updated.message
            : "Unable to update this income transaction.",
        );
      }
      setIncomeTransactions((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, include: updated.include }
            : item,
        ),
      );
    } catch (includeError) {
      setError(
        includeError instanceof Error
          ? includeError.message
          : "Unable to update this income transaction.",
      );
    } finally {
      setSavingIncludeId(null);
    }
  }

  async function addIncomeEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const grossPay = Number(form.grossPay);
    const netPay = Number(form.netPay);
    if (!form.employer.trim() || grossPay < 0 || netPay < 0) {
      setError("Enter an employer and valid gross/net pay amounts.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/income-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employer: form.employer.trim(),
          period_start: form.periodStart,
          period_end: form.periodEnd,
          pay_date: form.payDate,
          gross_pay: grossPay.toFixed(2),
          net_pay: netPay.toFixed(2),
          breakdown: {},
        }),
      });
      const created = (await response.json().catch(() => null)) as
        | IncomeEntry
        | { message?: string }
        | null;
      if (!response.ok || !created || !("id" in created)) {
        throw new Error(
          created && "message" in created && created.message
            ? created.message
            : "Unable to add the income entry.",
        );
      }
      setEntries((current) => [created, ...current]);
      setForm({
        employer: "",
        periodStart: todayString(),
        periodEnd: todayString(),
        payDate: todayString(),
        grossPay: "",
        netPay: "",
      });
      setFormOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to add the income entry.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function importIncomeFiles(files: File[]) {
    const validationError = validatePdfImportFiles(files);
    if (validationError) {
      setImportMessage("");
      setError(validationError);
      return;
    }

    setImporting(true);
    setError("");
    setImportMessage("");
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      const response = await fetch(
        `${APP_BASE_PATH}/api/income-entries/import-pdf`,
        {
          method: "POST",
          body: formData,
        },
      );
      const result = (await response.json().catch(() => null)) as
        | {
          created: IncomeEntry[];
          updated: IncomeEntry[];
          created_count: number;
          updated_count: number;
          duplicate_count: number;
          error_count: number;
          errors: Array<{ file: string; detail: string }>;
          }
        | { detail?: string; message?: string }
        | null;
      if (!response.ok || !result || !("created" in result)) {
        throw new Error(
          result && "detail" in result && result.detail
            ? result.detail
            : result && "message" in result && result.message
              ? result.message
              : "Unable to import income statements.",
        );
      }
      const changedEntries = [
        ...result.created,
        ...(result.updated || []),
      ];
      if (changedEntries.length) {
        setEntries((current) => {
          const changedById = new Map(
            changedEntries.map((entry) => [entry.id, entry]),
          );
          const merged = current.map((entry) => changedById.get(entry.id) || entry);
          const currentIds = new Set(current.map((entry) => entry.id));
          const newEntries = changedEntries.filter(
            (entry) => !currentIds.has(entry.id),
          );
          return [...newEntries, ...merged];
        });
      }
      const createdText =
        result.created_count === 1
          ? "Imported 1 income statement."
          : `Imported ${result.created_count} income statements.`;
      const updatedText = result.updated_count
        ? ` ${result.updated_count} existing ${
            result.updated_count === 1 ? "statement was" : "statements were"
          } updated.`
        : "";
      const duplicateText = result.duplicate_count
        ? ` ${result.duplicate_count} duplicate ${
            result.duplicate_count === 1 ? "was" : "were"
          } matched.`
        : "";
      const errorText = result.error_count
        ? ` ${result.error_count} ${
            result.error_count === 1 ? "file" : "files"
          } failed: ${result.errors
            .map((item) => `${item.file} (${item.detail})`)
            .join("; ")}`
        : "";
      setImportMessage(`${createdText}${updatedText}${duplicateText}${errorText}`);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to import income statements.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mt-8 space-y-5">
      {error ? (
        <p
          className="rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {importMessage ? (
        <p
          className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="status"
        >
          {importMessage}
        </p>
      ) : null}

      <section className="surface rounded-2xl">
        <div className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.045] px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
              Income history
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Pay statements and income records
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Import ADP pay-statement PDFs or add income manually. Duplicate
              statement imports are skipped using the ADP advice number.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-10 min-w-36 cursor-pointer items-center justify-center rounded-lg border border-white/10 px-4 text-center text-xs font-semibold leading-none text-white/65 transition hover:border-accent/20 hover:text-accent">
              {importing ? "Importing…" : "Import"}
              <input
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={importing}
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  if (files.length) {
                    void importIncomeFiles(files);
                  }
                  event.target.value = "";
                }}
                type="file"
              />
            </label>
            <button
              className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/15"
              onClick={() => setFormOpen((current) => !current)}
              type="button"
            >
              {formOpen ? "Cancel" : "Add income"}
            </button>
          </div>
        </div>

        <div className="border-b border-white/[0.07] px-5 py-4">
          <DateRangePicker range={dateRange} onApply={setDateRange} />
        </div>

        <div className="grid grid-cols-2 border-b border-white/[0.07] bg-black/10 lg:grid-cols-5">
          <div className="border-r border-white/[0.07] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Gross income
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              <MoneyHoverCard
                entries={grossStatementEntries}
                label="Gross income"
                total={totalGross}
              />
            </p>
          </div>
          <div className="px-5 py-4 lg:npborder-r lg:border-white/[0.07]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Taxes withheld
            </p>
            <p className="mt-1 text-xl font-semibold text-rose-200">
              <MoneyHoverCard
                entries={taxBreakdownEntries}
                label="Taxes withheld"
                total={totalTaxes}
              />
            </p>
          </div>
          <div className="border-r border-t border-white/[0.07] px-5 py-4 lg:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Deductions
            </p>
            <p className="mt-1 text-xl font-semibold text-amber-100">
              <MoneyHoverCard
                entries={deductionBreakdownEntries}
                label="Deductions"
                total={totalDeductions}
              />
            </p>
          </div>
          <div className="border-t border-white/[0.07] px-5 py-4 lg:border-r lg:border-t-0 lg:border-white/[0.07]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Net income
            </p>
            <p className="mt-1 text-xl font-semibold text-accent">
              <MoneyHoverCard
                entries={netStatementEntries}
                label="Net income"
                total={totalNet}
              />
            </p>
          </div>
          <div className="col-span-2 border-t border-white/[0.07] px-5 py-4 lg:col-span-1 lg:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Avg net pay
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              <MoneyHoverCard
                entries={averageNetEntries}
                label="Average net pay"
                total={averageNet}
              />
            </p>
          </div>
        </div>
        {formOpen ? (
          <form
            className="grid gap-3 border-b border-white/[0.07] bg-black/10 p-5 sm:grid-cols-3"
            onSubmit={addIncomeEntry}
          >
            <label className="sm:col-span-3">
              <span className="mb-2 block text-xs font-medium text-muted">
                Employer
              </span>
              <input
                autoComplete="off"
                className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-accent/50"
                data-1p-ignore
                data-op-ignore
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    employer: event.target.value,
                  }))
                }
                required
                value={form.employer}
              />
            </label>
            {[
              ["Period start", "periodStart"],
              ["Period end", "periodEnd"],
              ["Pay date", "payDate"],
            ].map(([label, key]) => (
              <label key={key}>
                <span className="mb-2 block text-xs font-medium text-muted">
                  {label}
                </span>
                <input
                  className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-accent/50"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  required
                  type="date"
                  value={form[key as keyof typeof form]}
                />
              </label>
            ))}
            {[
              ["Gross pay", "grossPay"],
              ["Net pay", "netPay"],
            ].map(([label, key]) => (
              <label key={key}>
                <span className="mb-2 block text-xs font-medium text-muted">
                  {label}
                </span>
                <input
                  autoComplete="off"
                  className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-right font-mono text-sm text-white outline-none focus:border-accent/50"
                  data-1p-ignore
                  data-op-ignore
                  inputMode="decimal"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                  required
                  type="text"
                  value={form[key as keyof typeof form]}
                />
              </label>
            ))}
            <button
              className="h-10 rounded-lg bg-accent-strong px-4 text-sm font-semibold text-[#03120c] transition hover:bg-accent disabled:opacity-50 sm:col-span-3"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving…" : "Save income"}
            </button>
          </form>
        ) : null}

        <div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-white/[0.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted sm:grid-cols-[1fr_120px_120px_120px_120px]">
            <span>Statement</span>
            <span className="text-right">Gross</span>
            <span className="hidden text-right sm:block">Taxes</span>
            <span className="hidden text-right sm:block">Deductions</span>
            <span className="text-right">Net</span>
          </div>
          {filteredEntries.length ? (
            filteredEntries.map((entry) => {
              const syncedTransaction = syncedIncomeByEntryId.get(entry.id);
              const taxEntries = breakdownEntries(entry.breakdown?.taxes, {
                onlyNegative: true,
              });
              const taxes = taxEntries.reduce(
                (total, [, value]) => total + value,
                0,
              );
              const knownDeductionEntries = breakdownEntries(
                entry.breakdown?.deductions,
                { excludeLabels: ["Cell"], onlyNegative: true },
              );
              const knownDeductions = knownDeductionEntries.reduce(
                (total, [, value]) => total + value,
                0,
              );
              const deductions =
                Number(entry.gross_pay) - taxes - Number(entry.net_pay);
              const deductionAdjustment = deductions - knownDeductions;
              const deductionEntries: MoneyBreakdownEntry[] = [
                ...knownDeductionEntries,
              ];
              if (Math.abs(deductionAdjustment) >= 0.01) {
                deductionEntries.push([
                  deductionAdjustment > 0
                    ? "Uncategorized payroll adjustment"
                    : "Payroll credit / reimbursement",
                  deductionAdjustment,
                ]);
              }
              return (
                <div
                  className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-white/[0.05] px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_120px_120px_120px_120px]"
                  key={entry.id}
                >
                  <div>
                    <p className="font-medium text-white">{entry.employer}</p>
                    <p className="mt-1 text-xs text-muted">
                      Paid {formatDate(entry.pay_date)} · Period{" "}
                      {formatDate(entry.period_start)} -{" "}
                      {formatDate(entry.period_end)}
                      {entry.statement_pdf_url ? (
                        <>
                          {" "}
                          ·{" "}
                          <a
                            className="font-medium text-accent/80 underline decoration-accent/30 underline-offset-4 hover:text-accent"
                            href={entry.statement_pdf_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            PDF
                          </a>
                        </>
                      ) : null}
                      {syncedTransaction ? (
                        <>
                          {" "}
                          · Synced to {syncedTransaction.issuer} ••••{" "}
                          {syncedTransaction.account_last_four}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <p className="self-center text-right text-sm text-white/75">
                    <MoneyHoverCard
                      className="w-full"
                      entries={[
                        [
                          `${formatDate(entry.period_start)} - ${formatDate(
                            entry.period_end,
                          )}`,
                          Number(entry.gross_pay),
                        ],
                      ]}
                      label="Gross income"
                      total={Number(entry.gross_pay)}
                    />
                  </p>
                  <p className="hidden self-center text-right text-sm text-rose-200 sm:block">
                    <MoneyHoverCard
                      className="w-full"
                      entries={taxEntries}
                      label="Taxes withheld"
                      total={taxes}
                    />
                  </p>
                  <p className="hidden self-center text-right text-sm text-amber-100 sm:block">
                    <MoneyHoverCard
                      className="w-full"
                      entries={deductionEntries}
                      label="Deductions withheld"
                      total={deductions}
                    />
                  </p>
                  <p className="self-center text-right text-sm font-semibold text-accent">
                    <MoneyHoverCard
                      className="w-full"
                      entries={[
                        ["Direct deposit / net pay", Number(entry.net_pay)],
                      ]}
                      label="Net income"
                      total={Number(entry.net_pay)}
                    />
                  </p>
                </div>
              );
            })
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted">
              No income records found for {formatExpenseDateRange(dateRange)}.
            </p>
          )}
        </div>
        <div className="border-t border-white/[0.07]">
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] bg-black/10 px-5 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">Synced account income</p>
              <p className="mt-1 text-xs text-muted">Unmatched Plaid income deposited into checking and savings; exclude individual transactions from the income ledger as needed.</p>
            </div>
            <p className="font-mono text-sm font-semibold text-accent">{money(syncedAccountIncomeTotal)}</p>
          </div>
          {syncedAccountIncome.length ? syncedAccountIncome.map((transaction) => (
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-b border-white/[0.05] px-5 py-4 last:border-b-0" key={transaction.id}>
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{transaction.description}</p>
                <p className="mt-1 text-xs text-muted">{formatDate(transaction.transaction_date)} · {transaction.issuer} •••• {transaction.account_last_four}</p>
              </div>
              <p className="self-center font-mono text-sm font-semibold text-accent">{money(transaction.amount)}</p>
              <button
                aria-pressed={transaction.include}
                className={`self-center rounded-full border px-2.5 py-1 text-[10px] font-semibold transition disabled:opacity-50 ${transaction.include ? "border-accent/25 bg-accent/10 text-accent" : "border-rose-300/20 bg-rose-400/10 text-rose-100"}`}
                disabled={savingIncludeId === transaction.id}
                onClick={() => void toggleSyncedIncomeInclude(transaction)}
                type="button"
              >
                {transaction.include ? "Included" : "Excluded"}
              </button>
            </div>
          )) : (
            <p className="px-5 py-8 text-center text-sm text-muted">No synced checking or savings income found for {formatExpenseDateRange(dateRange)}.</p>
          )}
        </div>
      </section>
    </div>
  );
}
