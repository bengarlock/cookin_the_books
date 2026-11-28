"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import {
  usePaydayOverrides,
  useSetPaydayOverrides,
} from "@/components/payday-overrides";
import { APP_BASE_PATH } from "@/lib/config";
import {
  getCurrentPayPeriod,
  getNextPayCycle,
  isValidPaydayOverride,
  localPaydayString,
  parsePaydayDate,
  scheduledPaydaysBetween,
  type PaydayOverrides,
} from "@/lib/pay-cycle";

const MONTHS_BACK = 2;
const MONTHS_AHEAD = 4;

const longDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dayDifference(from: Date, to: Date) {
  return Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      86_400_000,
  );
}

function shiftLabel(scheduled: Date, actual: Date) {
  const days = dayDifference(scheduled, actual);
  if (!days) return null;
  const amount = `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  return days < 0 ? `${amount} early` : `${amount} late`;
}

function saveError(data: unknown) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const details = record.payday_overrides;
    if (details && typeof details === "object") {
      return Object.entries(details)
        .map(([scheduled, message]) => {
          const date = parsePaydayDate(scheduled);
          const label = date ? shortDate.format(date) : scheduled;
          return `${label}: ${Array.isArray(message) ? message.join(" ") : String(message)}`;
        })
        .join(" ");
    }
    if (typeof record.message === "string") return record.message;
  }
  return "Paydays could not be saved. Please try again.";
}

/**
 * Lets the user record a one-off payday change, e.g. payroll paying on
 * Friday instead of the scheduled Tuesday. Each scheduled payday can be moved
 * anywhere between the paydays before and after it.
 */
export function PaydayOverridesEditor({
  onSaved,
}: {
  onSaved?: () => void;
}) {
  const router = useRouter();
  const savedOverrides = usePaydayOverrides();
  const setSavedOverrides = useSetPaydayOverrides();
  const [drafts, setDrafts] = useState<PaydayOverrides>(savedOverrides);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    const today = new Date();
    const windowStart = new Date(today.getFullYear(), today.getMonth() - MONTHS_BACK, 1);
    const windowEnd = new Date(today.getFullYear(), today.getMonth() + MONTHS_AHEAD + 1, 0);
    // Include one payday on each side so every visible row knows its limits.
    const paydays = scheduledPaydaysBetween(
      addDays(windowStart, -31),
      addDays(windowEnd, 31),
    );
    return paydays
      .map((scheduled, index) => ({
        scheduled,
        key: localPaydayString(scheduled),
        min: paydays[index - 1] ? addDays(paydays[index - 1], 1) : null,
        max: paydays[index + 1] ? addDays(paydays[index + 1], -1) : null,
      }))
      .filter(
        (row) =>
          row.min && row.max && row.scheduled >= windowStart && row.scheduled <= windowEnd,
      ) as { scheduled: Date; key: string; min: Date; max: Date }[];
  }, []);

  const preview = useMemo(() => getCurrentPayPeriod(new Date(), null, drafts), [drafts]);
  const nextPaydayKey = useMemo(
    () => localPaydayString(getNextPayCycle(new Date(), null, drafts).nextPayday),
    [drafts],
  );
  const nextPaydayRow = useRef<HTMLLIElement>(null);

  // Open the list on the upcoming payday instead of months in the past.
  useEffect(() => {
    nextPaydayRow.current?.scrollIntoView({ block: "center" });
  }, []);
  const hasChanges =
    JSON.stringify(Object.entries(drafts).sort()) !==
    JSON.stringify(Object.entries(savedOverrides).sort());
  const invalidKeys = Object.entries(drafts)
    .filter(([scheduled, actual]) => !isValidPaydayOverride(scheduled, actual))
    .map(([scheduled]) => scheduled);

  function setActual(key: string, value: string) {
    setStatus("");
    setError("");
    setDrafts((current) => {
      const next = { ...current };
      if (!value || value === key) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  async function save() {
    if (invalidKeys.length) {
      setError("Keep each payday between the paydays before and after it.");
      return;
    }
    setIsSaving(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/budget-plan-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payday_overrides: drafts }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(saveError(data));
      if (!data || typeof data.payday_overrides !== "object") {
        throw new Error("Paydays could not be saved. Please try again.");
      }
      setDrafts(data.payday_overrides);
      setSavedOverrides(data.payday_overrides);
      setStatus("Paydays saved.");
      router.refresh();
      onSaved?.();
    } catch (saveFailure) {
      setError(
        saveFailure instanceof Error
          ? saveFailure.message
          : "Paydays could not be saved. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    // Not a <form>: the editor also opens inside the goal form, and forms
    // cannot nest.
    <div className="space-y-5">
      <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm">
        <span className="text-white/60">Current pay period with these paydays: </span>
        <span className="font-semibold text-white">
          {shortDate.format(preview.start)} – {shortDate.format(preview.end)}
        </span>
      </div>
      <fieldset className="disabled:opacity-60" disabled={isSaving}>
        <legend className="sr-only">Actual payday for each scheduled payday</legend>
        <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
          {rows.map((row) => {
            const actualValue = drafts[row.key] ?? row.key;
            const actual = parsePaydayDate(actualValue) ?? row.scheduled;
            const shift = shiftLabel(row.scheduled, actual);
            const invalid = invalidKeys.includes(row.key);
            const inputId = `payday-${row.key}`;
            const isNext = localPaydayString(actual) === nextPaydayKey;
            return (
              <li
                aria-current={isNext ? "date" : undefined}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${
                  isNext
                    ? "relative bg-accent/10 shadow-[inset_3px_0_0_var(--color-accent)] ring-1 ring-inset ring-accent/40"
                    : ""
                }`}
                key={row.key}
                ref={isNext ? nextPaydayRow : undefined}
              >
                <label className="min-w-40 flex-1 text-sm text-white" htmlFor={inputId}>
                  <span className="flex flex-wrap items-center gap-2">
                    {longDate.format(row.scheduled)}
                    {isNext ? (
                      <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                        Next payday
                      </span>
                    ) : null}
                  </span>
                  <span className={`block text-xs ${isNext ? "text-accent/80" : "text-white/45"}`}>
                    {isNext ? "Next expected payday" : "Scheduled payday"}
                  </span>
                </label>
                {shift ? (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      invalid
                        ? "border-red-400/40 text-red-300"
                        : "border-gold/30 bg-gold/10 text-gold"
                    }`}
                  >
                    Paid {shift}
                  </span>
                ) : null}
                <input
                  aria-describedby={invalid ? `${inputId}-error` : undefined}
                  aria-invalid={invalid || undefined}
                  aria-label={`Actual payday for ${longDate.format(row.scheduled)}${
                    isNext ? " (next payday)" : ""
                  }`}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none [color-scheme:dark] focus:border-accent/60"
                  id={inputId}
                  max={localPaydayString(row.max)}
                  min={localPaydayString(row.min)}
                  onChange={(event) => setActual(row.key, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                  type="date"
                  value={actualValue}
                />
                <button
                  aria-label={`Reset ${longDate.format(row.scheduled)} payday`}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:border-accent/40 hover:text-white disabled:opacity-40"
                  disabled={!drafts[row.key]}
                  onClick={() => setActual(row.key, "")}
                  type="button"
                >
                  Reset
                </button>
                {invalid ? (
                  <p className="w-full text-xs text-red-300" id={`${inputId}-error`}>
                    Choose a date between {shortDate.format(row.min)} and{" "}
                    {shortDate.format(row.max)}.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div aria-live="polite" className="min-h-5 text-sm">
        {error ? (
          <p className="text-red-300" role="alert">{error}</p>
        ) : (
          <p className="text-emerald-300" role="status">{status}</p>
        )}
      </div>
      <button
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
        disabled={isSaving || !hasChanges}
        onClick={save}
        type="button"
      >
        {isSaving ? "Saving…" : "Save paydays"}
      </button>
    </div>
  );
}

/** Opens the payday editor in a dialog without leaving the current form. */
export function AdjustPaydaysButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="shrink-0 whitespace-nowrap rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/70 transition hover:border-accent/40 hover:text-white"
        onClick={() => setOpen(true)}
        title="Record a paycheck that landed early or late"
        type="button"
      >
        Adjust paydays
      </button>
      {open
        ? createPortal(
        <div
          aria-labelledby="adjust-paydays-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          role="dialog"
        >
          <div className="surface flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-line/70 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                  Pay schedule
                </p>
                <h3 className="mt-1 text-lg font-semibold text-white" id="adjust-paydays-title">
                  Adjust paydays
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Paid early or late? Set the date the paycheck actually landed.
                  Pay periods, goals, and automations use it from now on.
                </p>
              </div>
              <button
                autoFocus
                className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-muted hover:text-white"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <PaydayOverridesEditor onSaved={() => setOpen(false)} />
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
