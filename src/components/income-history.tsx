"use client";

import { FormEvent, useMemo, useState } from "react";

import { DateRangePicker } from "@/components/date-range-picker";
import { APP_BASE_PATH } from "@/lib/config";
import {
  defaultExpenseDateRange,
  formatExpenseDateRange,
  type ExpenseDateRange,
} from "@/lib/expense-date-range";
import type { IncomeEntry } from "@/lib/income-entry-types";
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

export function IncomeHistory({
  initialEntries,
}: {
  initialEntries: IncomeEntry[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [dateRange, setDateRange] = useState<ExpenseDateRange>(
    defaultExpenseDateRange(),
  );
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importMessage, setImportMessage] = useState("");
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
  const totalGross = filteredEntries.reduce(
    (total, entry) => total + Number(entry.gross_pay),
    0,
  );
  const totalNet = filteredEntries.reduce(
    (total, entry) => total + Number(entry.net_pay),
    0,
  );
  const totalTaxes = filteredEntries.reduce((total, entry) => {
    const taxes = Object.values(entry.breakdown?.taxes || {});
    return (
      total +
      taxes.reduce((taxTotal, value) => taxTotal + Math.abs(Number(value)), 0)
    );
  }, 0);
  const averageNet = filteredEntries.length
    ? totalNet / filteredEntries.length
    : 0;

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
            created_count: number;
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
      if (result.created.length) {
        setEntries((current) => [...result.created, ...current]);
      }
      const createdText =
        result.created_count === 1
          ? "Imported 1 income statement."
          : `Imported ${result.created_count} income statements.`;
      const duplicateText = result.duplicate_count
        ? ` ${result.duplicate_count} duplicate ${
            result.duplicate_count === 1 ? "was" : "were"
          } skipped.`
        : "";
      const errorText = result.error_count
        ? ` ${result.error_count} ${
            result.error_count === 1 ? "file" : "files"
          } failed: ${result.errors
            .map((item) => `${item.file} (${item.detail})`)
            .join("; ")}`
        : "";
      setImportMessage(`${createdText}${duplicateText}${errorText}`);
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

      <section className="surface overflow-hidden rounded-2xl">
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

        <div className="grid grid-cols-2 border-b border-white/[0.07] bg-black/10 lg:grid-cols-4">
          <div className="border-r border-white/[0.07] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Net income
            </p>
            <p className="mt-1 font-mono text-xl font-semibold text-accent">
              {money(totalNet)}
            </p>
          </div>
          <div className="px-5 py-4 lg:border-r lg:border-white/[0.07]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Gross income
            </p>
            <p className="mt-1 font-mono text-xl font-semibold text-white">
              {money(totalGross)}
            </p>
          </div>
          <div className="border-r border-t border-white/[0.07] px-5 py-4 lg:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Taxes withheld
            </p>
            <p className="mt-1 font-mono text-xl font-semibold text-rose-200">
              {money(totalTaxes)}
            </p>
          </div>
          <div className="border-t border-white/[0.07] px-5 py-4 lg:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Avg net pay
            </p>
            <p className="mt-1 font-mono text-xl font-semibold text-white">
              {money(averageNet)}
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
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-white/[0.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted sm:grid-cols-[1fr_140px_140px_120px]">
            <span>Statement</span>
            <span className="text-right">Gross</span>
            <span className="text-right">Net</span>
            <span className="hidden text-right sm:block">Taxes</span>
          </div>
          {filteredEntries.length ? (
            filteredEntries.map((entry) => {
              const taxes = Object.values(entry.breakdown?.taxes || {}).reduce(
                (total, value) => total + Math.abs(Number(value)),
                0,
              );
              return (
                <div
                  className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-white/[0.05] px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_140px_140px_120px]"
                  key={entry.id}
                >
                  <div>
                    <p className="font-medium text-white">{entry.employer}</p>
                    <p className="mt-1 text-xs text-muted">
                      Paid {formatDate(entry.pay_date)} · Period{" "}
                      {formatDate(entry.period_start)} -{" "}
                      {formatDate(entry.period_end)}
                      {entry.advice_number
                        ? ` · Advice ${entry.advice_number}`
                        : ""}
                    </p>
                  </div>
                  <p className="self-center text-right font-mono text-sm text-white/75">
                    {money(entry.gross_pay)}
                  </p>
                  <p className="self-center text-right font-mono text-sm font-semibold text-accent">
                    {money(entry.net_pay)}
                  </p>
                  <p className="hidden self-center text-right font-mono text-sm text-rose-200 sm:block">
                    {money(taxes)}
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
      </section>
    </div>
  );
}
