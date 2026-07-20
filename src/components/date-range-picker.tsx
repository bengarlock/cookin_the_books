"use client";

import { useMemo, useState } from "react";

import {
  allTimeExpenseDateRange,
  type ExpenseDateRange,
  expenseDateRangePreset,
  formatExpenseDateRange,
  localDateString,
  parseLocalDate,
} from "@/lib/expense-date-range";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const shortcutControlClass =
  "min-h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold leading-none text-white/65 transition hover:border-accent/25 hover:bg-accent/10 hover:text-accent";

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function yearRange(year: number) {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

function fallbackYears(allTimeStart: string | undefined) {
  const currentYear = new Date().getFullYear();
  if (!allTimeStart) {
    return [currentYear, currentYear - 1, currentYear - 2];
  }

  const startYear = parseLocalDate(allTimeStart).getFullYear();
  return Array.from(
    { length: Math.max(1, currentYear - startYear + 1) },
    (_, index) => currentYear - index,
  );
}

function uniqueDescendingYears(years: number[]) {
  return Array.from(
    new Set(
      years
        .filter((year) => Number.isInteger(year))
        .map((year) => Math.trunc(year)),
    ),
  ).sort((left, right) => right - left);
}

export function DateRangePicker({
  range,
  onApply,
  dialogLabel = "Select expense date range",
  allTimeStart,
  availableYears,
  triggerClassName,
}: {
  range: ExpenseDateRange;
  onApply: (range: ExpenseDateRange) => void;
  dialogLabel?: string;
  allTimeStart?: string;
  availableYears?: number[];
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(range);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const end = parseLocalDate(range.end);
    return new Date(end.getFullYear(), end.getMonth(), 1);
  });
  const [selectingEnd, setSelectingEnd] = useState(false);
  const yearOptions = useMemo(() => {
    const years = availableYears?.length
      ? availableYears
      : fallbackYears(allTimeStart);
    return uniqueDescendingYears(years);
  }, [allTimeStart, availableYears]);
  const selectedYear =
    draft.start.slice(5) === "01-01" &&
    draft.end.slice(5) === "12-31" &&
    yearOptions.includes(Number(draft.start.slice(0, 4)))
      ? draft.start.slice(0, 4)
      : "";

  function openPicker() {
    const end = parseLocalDate(range.end);
    setDraft(range);
    setVisibleMonth(new Date(end.getFullYear(), end.getMonth(), 1));
    setSelectingEnd(false);
    setIsOpen(true);
  }

  function chooseDate(date: Date) {
    const value = localDateString(date);
    if (!selectingEnd) {
      setDraft({ start: value, end: value });
      setSelectingEnd(true);
      return;
    }

    setDraft((current) =>
      value < current.start
        ? { start: value, end: current.start }
        : { start: current.start, end: value },
    );
    setSelectingEnd(false);
  }

  return (
    <>
      <button
        className={
          triggerClassName ||
          "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-left text-xs font-medium text-white/70 transition hover:border-accent/25 hover:text-accent"
        }
        onClick={openPicker}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="size-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M7 3v3m10-3v3M4.5 9.5h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
        </svg>
        <span className="min-w-0 truncate">{formatExpenseDateRange(range)}</span>
      </button>

      {isOpen ? (
        <div
          className="themed-dialog-overlay fixed inset-0 z-50 grid place-items-center bg-[#020906]/75 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setIsOpen(false);
          }}
        >
          <div
            aria-label={dialogLabel}
            aria-modal="true"
            className="themed-popover w-full max-w-md rounded-2xl border border-white/15 bg-[#0b1714] p-5 shadow-2xl shadow-black/50"
            role="dialog"
          >
            <div className="flex items-center justify-between">
              <button
                aria-label="Previous month"
                className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-xl text-white/75 hover:border-accent/25 hover:text-accent"
                onClick={() =>
                  setVisibleMonth(
                    (current) =>
                      new Date(
                        current.getFullYear(),
                        current.getMonth() - 1,
                        1,
                      ),
                  )
                }
                type="button"
              >
                ‹
              </button>
              <h3 className="text-lg font-semibold text-white">
                {monthFormatter.format(visibleMonth)}
              </h3>
              <button
                aria-label="Next month"
                className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-xl text-white/75 hover:border-accent/25 hover:text-accent"
                onClick={() =>
                  setVisibleMonth(
                    (current) =>
                      new Date(
                        current.getFullYear(),
                        current.getMonth() + 1,
                        1,
                      ),
                  )
                }
                type="button"
              >
                ›
              </button>
            </div>

            <div className="mt-5 grid grid-cols-7 text-center">
              {weekdayLabels.map((label) => (
                <span
                  className="pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted"
                  key={label}
                >
                  {label}
                </span>
              ))}
              {calendarDays(visibleMonth).map((date) => {
                const value = localDateString(date);
                const isCurrentMonth =
                  date.getMonth() === visibleMonth.getMonth();
                const isEndpoint =
                  value === draft.start || value === draft.end;
                const isInRange =
                  value >= draft.start && value <= draft.end;

                return (
                  <button
                    aria-label={date.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                    className={`relative grid h-11 place-items-center text-sm font-medium transition ${
                      isEndpoint
                        ? "z-10 rounded-xl bg-accent-strong text-[#03120c]"
                        : isInRange
                          ? "bg-accent/10 text-accent"
                          : isCurrentMonth
                            ? "text-white/80 hover:bg-white/[0.06]"
                            : "text-white/25 hover:bg-white/[0.03]"
                    }`}
                    key={value}
                    onClick={() => chooseDate(date)}
                    type="button"
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/15 px-4 py-3 text-center">
              <p className="text-xs text-muted">
                {selectingEnd ? "Select an end date" : "Selected range"}
              </p>
              <p className="mt-1 text-sm font-semibold text-accent">
                {formatExpenseDateRange(draft)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Week", value: "week" as const },
                { label: "Month", value: "month" as const },
                { label: "YTD", value: "ytd" as const },
              ].map((preset) => (
                <button
                  className={shortcutControlClass}
                  key={preset.value}
                  onClick={() => {
                    const nextRange = expenseDateRangePreset(preset.value);
                    const end = parseLocalDate(nextRange.end);
                    setDraft(nextRange);
                    setVisibleMonth(
                      new Date(end.getFullYear(), end.getMonth(), 1),
                    );
                    setSelectingEnd(false);
                  }}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
              <label className="relative block">
                <span className="sr-only">Select year</span>
                <select
                  aria-label="Select year"
                  className={`${shortcutControlClass} h-full w-full appearance-none pr-8 outline-none focus:border-accent/40 focus:text-accent`}
                  onChange={(event) => {
                    const year = Number(event.target.value);
                    if (!year) return;
                    const nextRange = yearRange(year);
                    const end = parseLocalDate(nextRange.end);
                    setDraft(nextRange);
                    setVisibleMonth(
                      new Date(end.getFullYear(), end.getMonth(), 1),
                    );
                    setSelectingEnd(false);
                  }}
                  value={selectedYear}
                >
                  <option value="">Year</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/45"
                >
                  ▾
                </span>
              </label>
              <button
                className={shortcutControlClass}
                onClick={() => {
                  const nextRange = allTimeExpenseDateRange(
                    new Date(),
                    allTimeStart,
                  );
                  const end = parseLocalDate(nextRange.end);
                  setDraft(nextRange);
                  setVisibleMonth(
                    new Date(end.getFullYear(), end.getMonth(), 1),
                  );
                  setSelectingEnd(false);
                }}
                type="button"
              >
                All time
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/[0.05]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-semibold text-[#03120c] hover:bg-accent"
                onClick={() => {
                  onApply(draft);
                  setIsOpen(false);
                }}
                type="button"
              >
                Apply range
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
