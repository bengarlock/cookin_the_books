"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { APP_BASE_PATH } from "@/lib/config";
import type { BudgetPlanSettings } from "@/lib/budget-plan-settings-types";
import {
  calendarReminderOccurrences,
  calendarDayTotalCents,
  formatCalendarTotal,
  localDateFromKey,
  localDateKey,
  monthCalendarDays,
} from "@/lib/financial-reminder-dates";
import type { RecurringExpenseSuggestion } from "@/lib/financial-reminder-suggestions";
import { normalizeFinancialReminderAmount } from "@/lib/form-input-normalization";
import type {
  CustomRecurrenceType,
  FinancialReminder,
  FinancialReminderPayload,
  ReminderCadence,
  ReminderRecurrence,
} from "@/lib/financial-reminder-types";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const leadDayOptions = [0, 1, 3, 7, 14, 30, 60, 90, 180, 365];
const cadenceOptions: Array<{ value: ReminderCadence; label: string }> = [
  { value: "once", label: "Once before, plus on the due date" },
  { value: "daily", label: "Daily through the due date" },
  { value: "weekly", label: "Weekly, plus on the due date" },
  { value: "monthly", label: "Every 30 days, plus on the due date" },
];
const recurrenceOptions: Array<{ value: ReminderRecurrence; label: string }> = [
  { value: "none", label: "Does not repeat" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

type FormState = {
  title: string;
  amount: string;
  dueDate: string;
  notes: string;
  leadDays: string;
  cadence: ReminderCadence;
  recurrence: ReminderRecurrence;
  customRecurrenceType: CustomRecurrenceType;
  customRecurrenceValue: string;
  emailEnabled: boolean;
  homepageEnabled: boolean;
};

function emptyForm(dueDate = localDateKey(new Date())): FormState {
  return {
    title: "",
    amount: "",
    dueDate,
    notes: "",
    leadDays: "7",
    cadence: "once",
    recurrence: "none",
    customRecurrenceType: "month_day",
    customRecurrenceValue: String(localDateFromKey(dueDate).getDate()),
    emailEnabled: false,
    homepageEnabled: true,
  };
}

function formFromReminder(reminder: FinancialReminder): FormState {
  return {
    title: reminder.title,
    amount:
      reminder.amount && Number(reminder.amount) > 0
        ? `+${reminder.amount}`
        : reminder.amount ?? "",
    dueDate: reminder.due_date,
    notes: reminder.notes,
    leadDays: String(reminder.reminder_lead_days),
    cadence: reminder.reminder_cadence,
    recurrence: reminder.recurrence_frequency,
    customRecurrenceType: reminder.custom_recurrence_type ?? "month_day",
    customRecurrenceValue: String(
      reminder.custom_recurrence_value ??
        localDateFromKey(reminder.due_date).getDate(),
    ),
    emailEnabled: reminder.email_enabled,
    homepageEnabled: reminder.homepage_enabled,
  };
}

function currency(amount: string | null) {
  if (!amount) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount));
}

function friendlyDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(localDateFromKey(value));
}

function timingLabel(reminder: FinancialReminder) {
  if (reminder.days_until_due === 0) return "Due today";
  if (reminder.days_until_due === 1) return "Due tomorrow";
  if (reminder.days_until_due > 1) return `Due in ${reminder.days_until_due} days`;
  return `Due ${Math.abs(reminder.days_until_due)} days ago`;
}

function recurrenceLabel(
  recurrence: ReminderRecurrence,
  customType?: CustomRecurrenceType | null,
  customValue?: number | null,
) {
  if (recurrence === "custom" && customValue) {
    return customType === "interval_days"
      ? `every ${customValue} day${customValue === 1 ? "" : "s"}`
      : `monthly on day ${customValue}`;
  }
  return (
    recurrenceOptions
      .find((option) => option.value === recurrence)
      ?.label.toLocaleLowerCase() ?? recurrence
  );
}

function errorMessage(
  payload: unknown,
  fallback = "The reminder could not be saved.",
) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  for (const value of Object.values(record)) {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return fallback;
}

export function FinancialCalendar({
  initialReminders,
  initialSelectedId = null,
  initialSuggestions = [],
  initialDismissedSuggestionIds = [],
}: {
  initialReminders: FinancialReminder[];
  initialSelectedId?: number | null;
  initialSuggestions?: RecurringExpenseSuggestion[];
  initialDismissedSuggestionIds?: string[];
}) {
  const initialSelectedReminder =
    initialReminders.find((reminder) => reminder.id === initialSelectedId) ?? null;
  const [reminders, setReminders] = useState(initialReminders);
  const [visibleMonth, setVisibleMonth] = useState(
    () => {
      const initialDate = initialSelectedReminder
        ? localDateFromKey(initialSelectedReminder.due_date)
        : new Date();
      return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
    },
  );
  const [selectedId, setSelectedId] = useState<number | null>(
    initialSelectedReminder?.id ?? null,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(
    initialSelectedReminder?.due_date ?? null,
  );
  const [form, setForm] = useState<FormState>(() =>
    initialSelectedReminder
      ? formFromReminder(initialSelectedReminder)
      : emptyForm(),
  );
  const [showCompleted, setShowCompleted] = useState(
    Boolean(initialSelectedReminder?.is_completed),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<number | null>(null);
  const [moveMessage, setMoveMessage] = useState("");
  const [moveError, setMoveError] = useState("");
  const mutationInFlight = useRef(false);
  const pointerDrag = useRef<{
    id: number;
    pointerId: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const suppressDragClick = useRef(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(
    null,
  );
  const [usedSuggestionIds, setUsedSuggestionIds] = useState<string[]>([]);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState(
    initialDismissedSuggestionIds,
  );
  const [dismissingSuggestionId, setDismissingSuggestionId] = useState<
    string | null
  >(null);
  const [suggestionError, setSuggestionError] = useState("");
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const days = useMemo(() => monthCalendarDays(visibleMonth), [visibleMonth]);
  const todayKey = localDateKey(new Date());
  const visibleReminders = useMemo(
    () =>
      reminders.filter((reminder) => showCompleted || !reminder.is_completed),
    [reminders, showCompleted],
  );
  const calendarOccurrences = useMemo(
    () =>
      days.length
        ? calendarReminderOccurrences(
            visibleReminders,
            days[0].dateKey,
            days[days.length - 1].dateKey,
          )
        : [],
    [days, visibleReminders],
  );
  const upcoming = [...reminders]
    .filter((reminder) => !reminder.is_completed)
    .sort((left, right) => left.due_date.localeCompare(right.due_date))
    .slice(0, 5);
  const availableSuggestions = initialSuggestions.filter(
    (suggestion) =>
      !usedSuggestionIds.includes(suggestion.id) &&
      !dismissedSuggestionIds.includes(suggestion.id),
  );

  useEffect(() => {
    if (deletingId === null) return;

    function cancelDeleteConfirmation(event: PointerEvent) {
      if (!deleteButtonRef.current?.contains(event.target as Node)) {
        setDeletingId(null);
      }
    }

    document.addEventListener("pointerdown", cancelDeleteConfirmation);
    return () => document.removeEventListener("pointerdown", cancelDeleteConfirmation);
  }, [deletingId]);

  useEffect(() => {
    if (moveId === null) return;
    function cancelMove(event: KeyboardEvent) {
      if (event.key === "Escape") setMoveId(null);
    }
    document.addEventListener("keydown", cancelMove);
    return () => document.removeEventListener("keydown", cancelMove);
  }, [moveId]);

  async function moveReminder(reminderId: number, dueDate: string) {
    const reminder = reminders.find((item) => item.id === reminderId);
    if (!reminder || mutationInFlight.current) return;
    setMoveId(null);
    if (reminder.due_date === dueDate) {
      setMoveError("");
      setMoveMessage(`${reminder.title} is already on ${friendlyDate(dueDate)}.`);
      return;
    }
    mutationInFlight.current = true;
    setIsSaving(true);
    setMoveError("");
    setMoveMessage(`Moving ${reminder.title}…`);
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/financial-reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: dueDate }),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(data, "The reminder could not be moved."));
      const saved = data as FinancialReminder;
      setReminders((current) => current.map((item) => item.id === saved.id ? saved : item));
      if (selectedId === reminderId) {
        setSelectedDate(saved.due_date);
        // Preserve unsaved name, amount, and notes in the open editor.
        setForm((current) => ({ ...current, dueDate: saved.due_date }));
      }
      setMoveMessage(`${saved.title} moved to ${friendlyDate(saved.due_date)}.`);
    } catch (moveFailure) {
      setMoveMessage("");
      setMoveError(moveFailure instanceof Error ? moveFailure.message : "The reminder could not be moved.");
    } finally {
      mutationInFlight.current = false;
      setIsSaving(false);
    }
  }

  // Listen on the document so fast drags and releases outside the tile are
  // handled even when the pointer leaves the source before capture begins.
  useEffect(() => {
    function resetDrag() {
      pointerDrag.current = null;
      setDraggingId(null);
      setDropDate(null);
    }
    function trackPointer(event: PointerEvent) {
      const drag = pointerDrag.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
      drag.active = true;
      suppressDragClick.current = true;
      setMoveId(null);
      setDraggingId(drag.id);
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-calendar-date]");
      setDropDate(target?.dataset.calendarDate ?? null);
    }
    function releasePointer(event: PointerEvent) {
      const drag = pointerDrag.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      resetDrag();
      if (!drag.active) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-calendar-date]");
      if (target?.dataset.calendarDate) void moveReminder(drag.id, target.dataset.calendarDate);
    }
    function resetClick() {
      suppressDragClick.current = false;
    }
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") resetDrag();
    }
    document.addEventListener("pointerdown", resetClick, true);
    document.addEventListener("pointermove", trackPointer);
    document.addEventListener("pointerup", releasePointer);
    document.addEventListener("pointercancel", resetDrag);
    document.addEventListener("keydown", cancelOnEscape);
    window.addEventListener("blur", resetDrag);
    return () => {
      document.removeEventListener("pointerdown", resetClick, true);
      document.removeEventListener("pointermove", trackPointer);
      document.removeEventListener("pointerup", releasePointer);
      document.removeEventListener("pointercancel", resetDrag);
      document.removeEventListener("keydown", cancelOnEscape);
      window.removeEventListener("blur", resetDrag);
    };
  });

  function selectReminder(
    reminder: FinancialReminder,
    occurrenceDate = reminder.due_date,
  ) {
    if (mutationInFlight.current) return;
    setMoveId(null);
    setSelectedId(reminder.id);
    setSelectedDate(occurrenceDate);
    setForm(formFromReminder(reminder));
    setDeletingId(null);
    setError("");
    setAmountError("");
    setSelectedSuggestionId(null);
  }

  function startNewReminder(dueDate: string) {
    if (mutationInFlight.current) return;
    setMoveId(null);
    setSelectedId(null);
    setSelectedDate(dueDate);
    setForm(emptyForm(dueDate));
    setDeletingId(null);
    setError("");
    setAmountError("");
    setSelectedSuggestionId(null);
  }

  function reviewSuggestion(suggestion: RecurringExpenseSuggestion) {
    const dueDate = localDateFromKey(suggestion.due_date);
    setSelectedId(null);
    setSelectedDate(suggestion.due_date);
    setSelectedSuggestionId(suggestion.id);
    setForm({
      ...emptyForm(suggestion.due_date),
      title: suggestion.title,
      amount: suggestion.amount,
      recurrence: suggestion.recurrence_frequency,
      customRecurrenceType: "month_day",
      customRecurrenceValue: String(dueDate.getDate()),
    });
    setVisibleMonth(new Date(dueDate.getFullYear(), dueDate.getMonth(), 1));
    setDeletingId(null);
    setError("");
    setAmountError("");
  }

  function clearEditor() {
    setMoveId(null);
    setSelectedId(null);
    setSelectedDate(null);
    setForm(emptyForm());
    setDeletingId(null);
    setError("");
    setAmountError("");
    setSelectedSuggestionId(null);
  }

  async function dismissSuggestion(suggestionId: string) {
    const nextDismissedSuggestionIds = Array.from(
      new Set([...dismissedSuggestionIds, suggestionId]),
    );
    setDismissingSuggestionId(suggestionId);
    setSuggestionError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/budget-plan-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dismissed_financial_reminder_suggestions: nextDismissedSuggestionIds,
        }),
      });
      const data = (await response.json()) as BudgetPlanSettings | unknown;
      if (!response.ok) {
        throw new Error(
          errorMessage(data, "The suggestion could not be dismissed."),
        );
      }
      const saved = data as BudgetPlanSettings;
      setDismissedSuggestionIds(
        saved.dismissed_financial_reminder_suggestions ??
          nextDismissedSuggestionIds,
      );
      if (selectedSuggestionId === suggestionId) clearEditor();
    } catch (dismissError) {
      setSuggestionError(
        dismissError instanceof Error
          ? dismissError.message
          : "The suggestion could not be dismissed.",
      );
    } finally {
      setDismissingSuggestionId(null);
    }
  }

  async function saveReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationInFlight.current) return;
    setError("");
    if (!form.emailEnabled && !form.homepageEnabled) {
      setError("Choose email, home page, or both for this reminder.");
      return;
    }
    const amount = normalizeFinancialReminderAmount(form.amount);
    if (amount === null) {
      setAmountError("Enter a valid amount with no more than 2 decimal places.");
      return;
    }
    const payload: FinancialReminderPayload = {
      title: form.title.trim(),
      amount: amount || null,
      due_date: form.dueDate,
      notes: form.notes.trim(),
      reminder_lead_days: Number(form.leadDays),
      reminder_cadence: form.cadence,
      recurrence_frequency: form.recurrence,
      custom_recurrence_type:
        form.recurrence === "custom" ? form.customRecurrenceType : null,
      custom_recurrence_value:
        form.recurrence === "custom" ? Number(form.customRecurrenceValue) : null,
      email_enabled: form.emailEnabled,
      homepage_enabled: form.homepageEnabled,
    };
    mutationInFlight.current = true;
    setIsSaving(true);
    try {
      const response = await fetch(
        selectedId === null
          ? `${APP_BASE_PATH}/api/financial-reminders`
          : `${APP_BASE_PATH}/api/financial-reminders/${selectedId}`,
        {
          method: selectedId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as FinancialReminder | unknown;
      if (!response.ok) throw new Error(errorMessage(data));
      const saved = data as FinancialReminder;
      setReminders((current) => {
        const withoutSaved = current.filter((item) => item.id !== saved.id);
        return [...withoutSaved, saved].sort((left, right) =>
          left.due_date.localeCompare(right.due_date),
        );
      });
      if (selectedSuggestionId) {
        setUsedSuggestionIds((current) => [...current, selectedSuggestionId]);
      }
      const today = new Date();
      clearEditor();
      setVisibleMonth(
        new Date(today.getFullYear(), today.getMonth(), 1),
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The reminder could not be saved.",
      );
    } finally {
      mutationInFlight.current = false;
      setIsSaving(false);
    }
  }

  async function toggleCompleted(reminder: FinancialReminder) {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/financial-reminders/${reminder.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_completed: !reminder.is_completed }),
        },
      );
      const data = (await response.json()) as FinancialReminder | unknown;
      if (!response.ok) throw new Error(errorMessage(data));
      const updated = data as FinancialReminder;
      const refreshedResponse = await fetch(
        `${APP_BASE_PATH}/api/financial-reminders`,
        { cache: "no-store" },
      );
      if (refreshedResponse.ok) {
        setReminders((await refreshedResponse.json()) as FinancialReminder[]);
      } else {
        setReminders((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      }
      if (selectedId === updated.id) setForm(formFromReminder(updated));
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "The reminder could not be updated.",
      );
    } finally {
      mutationInFlight.current = false;
      setIsSaving(false);
    }
  }

  async function deleteReminder(reminderId: number) {
    if (mutationInFlight.current) return;
    if (deletingId !== reminderId) {
      setDeletingId(reminderId);
      return;
    }
    mutationInFlight.current = true;
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/financial-reminders/${reminderId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(errorMessage(data));
      }
      setReminders((current) => current.filter((item) => item.id !== reminderId));
      clearEditor();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The reminder could not be deleted.",
      );
      setDeletingId(null);
    } finally {
      mutationInFlight.current = false;
      setIsSaving(false);
    }
  }

  return (
    <>
      {availableSuggestions.length ? (
        <section className="surface mb-6 rounded-2xl p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              Suggestions
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Recurring expenses you may want to track
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-white/50">
              These are based on consistent merchant, amount, and timing patterns
              in your transaction history. Review each suggestion before saving it.
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {availableSuggestions.map((suggestion) => (
              <article
                className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
                key={suggestion.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white">
                      {suggestion.title}
                    </h3>
                    <p className="mt-1 text-xs text-white/45">
                      {recurrenceLabel(suggestion.recurrence_frequency)} · Typical{" "}
                      {currency(suggestion.amount)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-gold/20 bg-gold/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
                    {suggestion.occurrence_count} found
                  </span>
                </div>
                <p className="mt-3 text-xs text-white/55">
                  Next expected {friendlyDate(suggestion.due_date)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/15"
                    onClick={() => reviewSuggestion(suggestion)}
                    type="button"
                  >
                    Review suggestion
                  </button>
                  <button
                    aria-label={`Dismiss ${suggestion.title} suggestion`}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/50 transition hover:border-white/20 hover:text-white/75 disabled:cursor-wait disabled:opacity-50"
                    disabled={dismissingSuggestionId !== null}
                    onClick={() => void dismissSuggestion(suggestion.id)}
                    type="button"
                  >
                    {dismissingSuggestionId === suggestion.id
                      ? "Dismissing…"
                      : "Dismiss"}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {suggestionError ? (
            <p
              className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100"
              role="alert"
            >
              {suggestionError}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="surface overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  (month) => new Date(month.getFullYear(), month.getMonth() - 1, 1),
                )
              }
              aria-label="Previous month"
              className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-lg text-white/70 transition hover:border-white/20 hover:text-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  (month) => new Date(month.getFullYear(), month.getMonth() + 1, 1),
                )
              }
              aria-label="Next month"
              className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-lg text-white/70 transition hover:border-white/20 hover:text-white"
            >
              ›
            </button>
            <h2 className="ml-2 text-lg font-semibold text-white">
              {new Intl.DateTimeFormat("en-US", {
                month: "long",
                year: "numeric",
              }).format(visibleMonth)}
            </h2>
          </div>
          <button
            type="button"
            onClick={() =>
              setVisibleMonth(
                new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              )
            }
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
          >
            Today
          </button>
        </div>

        <div className="px-5 py-2 text-xs text-white/55">
          {moveId !== null ? (
            <span>Choose a destination date. <button type="button" className="text-accent underline" onClick={() => setMoveId(null)}>Cancel move</button></span>
          ) : "Drag saved entries to another date, or select an entry and choose Move on calendar."}
          <p role="status" className="text-accent">{moveMessage}</p>
          {moveError ? <p role="alert" className="text-red-300">{moveError}</p> : null}
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.025]">
              {weekdayLabels.map((label) => (
                <div
                  key={label}
                  className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-white/45"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const dayReminders = calendarOccurrences.filter(
                  (occurrence) => occurrence.dueDate === day.dateKey,
                );
                const isSelectedDate = selectedDate === day.dateKey;
                const dayTotal = calendarDayTotalCents(dayReminders);
                return (
                  <div
                    key={day.dateKey}
                    data-calendar-date={day.dateKey}
                    className={`relative min-h-28 overflow-hidden border-r border-b border-white/[0.07] last:border-r-0 ${dropDate === day.dateKey ? "bg-accent/20 ring-2 ring-inset ring-accent" : ""}`}
                  >
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        if (suppressDragClick.current) {
                          suppressDragClick.current = false;
                          return;
                        }
                        if (moveId !== null) {
                          void moveReminder(moveId, day.dateKey);
                          return;
                        }
                        startNewReminder(day.dateKey);
                        setVisibleMonth(
                          new Date(day.date.getFullYear(), day.date.getMonth(), 1),
                        );
                      }}
                      aria-label={`${moveId === null ? "Create reminder on" : "Move reminder to"} ${friendlyDate(day.dateKey)}`}
                      aria-pressed={isSelectedDate}
                      className={`absolute inset-0 z-0 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70 ${
                        isSelectedDate
                          ? "bg-accent/10 ring-1 ring-inset ring-accent/50"
                          : day.dateKey === todayKey
                            ? "bg-accent/[0.035] ring-1 ring-inset ring-accent/25 hover:bg-accent/10 hover:ring-accent/45"
                          : day.isCurrentMonth
                            ? "bg-white/[0.015] hover:bg-accent/[0.07] hover:ring-1 hover:ring-inset hover:ring-accent/30"
                            : "bg-black/10 hover:bg-accent/[0.05] hover:ring-1 hover:ring-inset hover:ring-accent/25"
                      }`}
                    >
                      <span
                        className={`absolute left-2 top-2 flex size-7 items-center justify-center text-xs transition ${
                          isSelectedDate || day.dateKey === todayKey
                            ? "font-bold text-accent"
                            : day.isCurrentMonth
                              ? "text-white/75"
                              : "text-white/30"
                        }`}
                      >
                        {day.date.getDate()}
                      </span>
                    </button>
                    {dayTotal !== BigInt(0) ? (
                      <span
                        aria-label={`Daily total ${formatCalendarTotal(dayTotal)}`}
                        title={`Daily total: ${formatCalendarTotal(dayTotal)}`}
                        className={`pointer-events-none absolute right-2 top-3 z-10 max-w-[calc(100%-2.75rem)] truncate text-right text-[10px] font-semibold tabular-nums ${dayTotal < BigInt(0) ? "text-rose-300" : "text-emerald-300"}`}
                      >
                        {formatCalendarTotal(dayTotal)}
                      </span>
                    ) : null}
                    <div className="pointer-events-none relative z-10 mt-9 space-y-1 px-2 pb-2">
                      {dayReminders.map((occurrence) => (
                        <button
                          type="button"
                          key={occurrence.key}
                          disabled={isSaving}
                          draggable={false}
                          style={{ touchAction: occurrence.projected ? "auto" : "none" }}
                          onPointerDown={(event) => {
                            suppressDragClick.current = false;
                            if (occurrence.projected || mutationInFlight.current || event.button !== 0 || !event.isPrimary) return;
                            pointerDrag.current = { id: occurrence.reminder.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false };
                          }}
                          onClick={() => {
                            if (suppressDragClick.current) {
                              suppressDragClick.current = false;
                              return;
                            }
                            if (moveId !== null) {
                              void moveReminder(moveId, occurrence.dueDate);
                              return;
                            }
                            selectReminder(occurrence.reminder, occurrence.dueDate);
                          }}
                          className={`pointer-events-auto block w-full truncate rounded-md border px-2 py-1 text-left text-[11px] font-medium transition disabled:opacity-60 ${draggingId === occurrence.reminder.id ? "opacity-50" : ""} ${!occurrence.projected ? "select-none cursor-grab active:cursor-grabbing" : ""} ${
                            occurrence.reminder.is_completed
                              ? "border-white/5 bg-white/[0.03] text-white/30 line-through"
                              : selectedId === occurrence.reminder.id &&
                                  selectedDate === occurrence.dueDate
                                ? "border-accent/50 bg-accent/20 text-accent"
                                : occurrence.projected
                                  ? "border-dashed border-sky-300/20 bg-sky-300/[0.06] text-sky-100/70 hover:border-sky-300/40"
                                : "border-sky-400/15 bg-sky-400/10 text-sky-100 hover:border-sky-400/35"
                          }`}
                          title={`${occurrence.reminder.title}${occurrence.reminder.amount ? ` — ${currency(occurrence.reminder.amount)}` : ""}${occurrence.projected ? " · Projected occurrence" : ""}`}
                        >
                          {occurrence.reminder.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
          <label className="flex items-center gap-2 text-sm text-white/60">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(event) => setShowCompleted(event.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Show completed
          </label>
          <p className="text-xs text-white/40">
            Totals include unpaid entries and projections. Dashed entries follow their recurring schedule.
          </p>
        </div>
      </section>

      <aside className="space-y-6">
        <section className="surface rounded-2xl p-5">
          {selectedDate === null ? (
            <div className="flex min-h-48 flex-col items-center justify-center py-6 text-center">
              <div className="flex size-11 items-center justify-center rounded-full border border-accent/25 bg-accent/10 text-accent">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5"
                >
                  <path d="M6 3v3" />
                  <path d="M18 3v3" />
                  <path d="M4 8h16" />
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M8 12h.01" />
                  <path d="M12 12h.01" />
                  <path d="M16 12h.01" />
                  <path d="M8 16h.01" />
                  <path d="M12 16h.01" />
                </svg>
              </div>
              <button
                type="button"
                onClick={() => startNewReminder(todayKey)}
                aria-label="Create reminder for today"
                className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Create
              </button>
              <h2 className="mt-1 text-xl font-semibold text-white">Select a date</h2>
              <p className="mt-2 max-w-64 text-sm leading-6 text-white/45">
                Choose a date on the calendar, or create a reminder for today.
              </p>
            </div>
          ) : (
            <>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                {selectedId === null ? "Create" : "Manage"}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                {selectedId === null ? "Financial reminder" : "Edit reminder"}
              </h2>
            </div>
            <button
              type="button"
              onClick={clearEditor}
              className="text-sm text-white/50 transition hover:text-white"
            >
              Clear
            </button>
          </div>

          <form onSubmit={saveReminder}>
            <fieldset disabled={isSaving} className="space-y-4">
            <label className="block text-sm text-white/65">
              Name
              <input
                autoComplete="off"
                data-1p-ignore
                data-op-ignore
                required
                maxLength={150}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Reminder name"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none transition placeholder:text-white/25 focus:border-accent/60"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="financial-reminder-amount"
                  className="block text-sm text-white/65"
                >
                  Amount
                  <input
                    id="financial-reminder-amount"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(event) => {
                      const value = event.target.value;
                      setAmountError("");
                      setForm({ ...form, amount: value });
                    }}
                    onBlur={() => {
                      const normalized = normalizeFinancialReminderAmount(form.amount);
                      if (normalized !== null) setForm((current) => ({ ...current, amount: normalized }));
                      else setAmountError("Enter a valid amount with no more than 2 decimal places.");
                    }}
                    aria-invalid={Boolean(amountError)}
                    aria-describedby={
                      amountError ? "financial-reminder-amount-help financial-reminder-amount-error" : "financial-reminder-amount-help"
                    }
                    placeholder="0.00"
                    className={`mt-1.5 w-full rounded-xl border bg-black/20 px-3 py-2.5 text-white outline-none transition placeholder:text-white/25 ${
                      amountError
                        ? "border-red-400/70 focus:border-red-400"
                        : "border-white/10 focus:border-accent/60"
                    }`}
                  />
                </label>
                <p id="financial-reminder-amount-help" className="mt-1.5 text-xs leading-5 text-white/45">
                  Costs default to negative. Use + for incoming payments.
                </p>
                {amountError ? (
                  <span
                    id="financial-reminder-amount-error"
                    role="alert"
                    className="mt-1.5 block text-xs text-red-300"
                  >
                    {amountError}
                  </span>
                ) : null}
              </div>
              <label className="block text-sm text-white/65">
                Due date
                <input
                  required
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-accent/60"
                />
              </label>
            </div>
            <label className="block text-sm text-white/65">
              Reminder starts
              <select
                value={form.leadDays}
                onChange={(event) => setForm({ ...form, leadDays: event.target.value })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-accent/60"
              >
                {leadDayOptions.map((daysBefore) => (
                  <option key={daysBefore} value={daysBefore}>
                    {daysBefore === 0
                      ? "On the due date"
                      : `${daysBefore} day${daysBefore === 1 ? "" : "s"} before`}
                  </option>
                ))}
              </select>
            </label>
            <div className="block text-sm text-white/65">
              <label htmlFor="financial-reminder-recurrence">Repeats</label>
              <select
                id="financial-reminder-recurrence"
                value={form.recurrence}
                onChange={(event) =>
                  setForm({
                    ...form,
                    recurrence: event.target.value as ReminderRecurrence,
                    customRecurrenceValue:
                      event.target.value === "custom" &&
                      form.recurrence !== "custom"
                        ? String(localDateFromKey(form.dueDate).getDate())
                        : form.customRecurrenceValue,
                  })
                }
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-accent/60"
              >
                {recurrenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {form.recurrence === "custom" ? (
                <span className="mt-3 grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <span className="block">
                    <span className="block text-xs font-medium text-white/55">
                      Custom schedule
                    </span>
                    <select
                      aria-label="Custom recurrence type"
                      value={form.customRecurrenceType}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          customRecurrenceType: event.target
                            .value as CustomRecurrenceType,
                          customRecurrenceValue:
                            event.target.value === "month_day"
                              ? String(localDateFromKey(form.dueDate).getDate())
                              : "1",
                        })
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-accent/60"
                    >
                      <option value="month_day">Specific day each month</option>
                      <option value="interval_days">Every number of days</option>
                    </select>
                  </span>
                  <span className="block">
                    <span className="block text-xs font-medium text-white/55">
                      {form.customRecurrenceType === "month_day"
                        ? "Day of month"
                        : "Repeat every (days)"}
                    </span>
                    <input
                      aria-label={
                        form.customRecurrenceType === "month_day"
                          ? "Day of month"
                          : "Repeat every number of days"
                      }
                      required
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={
                        form.customRecurrenceType === "month_day" ? 31 : 3650
                      }
                      value={form.customRecurrenceValue}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          customRecurrenceValue: event.target.value,
                        })
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-accent/60"
                    />
                    {form.customRecurrenceType === "month_day" ? (
                      <span className="mt-1.5 block text-xs leading-5 text-white/35">
                        Shorter months use their last available day.
                      </span>
                    ) : null}
                  </span>
                </span>
              ) : null}
              {form.recurrence !== "none" ? (
                <span className="mt-1.5 block text-xs leading-5 text-white/40">
                  Future dates appear as projections. Completing this reminder
                  creates its next actionable occurrence.
                </span>
              ) : null}
            </div>
            <label className="block text-sm text-white/65">
              Email cadence
              <select
                value={form.cadence}
                onChange={(event) =>
                  setForm({ ...form, cadence: event.target.value as ReminderCadence })
                }
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-accent/60"
              >
                {cadenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <legend className="px-1 text-sm text-white/65">Remind me by</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <label className="flex items-center gap-2 text-sm text-white/75">
                  <input
                    type="checkbox"
                    checked={form.homepageEnabled}
                    onChange={(event) =>
                      setForm({ ...form, homepageEnabled: event.target.checked })
                    }
                    className="size-4 accent-[var(--accent)]"
                  />
                  Home page
                </label>
                <label className="flex items-center gap-2 text-sm text-white/75">
                  <input
                    type="checkbox"
                    checked={form.emailEnabled}
                    onChange={(event) =>
                      setForm({ ...form, emailEnabled: event.target.checked })
                    }
                    className="size-4 accent-[var(--accent)]"
                  />
                  Email
                </label>
              </div>
            </fieldset>
            <label className="block text-sm text-white/65">
              Notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Add optional notes"
                className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none transition placeholder:text-white/25 focus:border-accent/60"
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="min-w-28 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? "Saving…" : selectedId === null ? "Save reminder" : "Save"}
              </button>
              {selectedId !== null ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setMoveId(selectedId); setMoveError(""); setMoveMessage(""); }}
                    className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/70 transition hover:border-accent/50"
                  >
                    Move on calendar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const reminder = reminders.find((item) => item.id === selectedId);
                      if (reminder) void toggleCompleted(reminder);
                    }}
                    className="min-w-24 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
                  >
                    {reminders.find((item) => item.id === selectedId)?.is_completed
                      ? "Reopen"
                      : "Complete"}
                  </button>
                  <button
                    ref={deleteButtonRef}
                    type="button"
                    onClick={() => void deleteReminder(selectedId)}
                    aria-label={
                      deletingId === selectedId
                        ? "Confirm delete reminder"
                        : "Delete reminder"
                    }
                    title={
                      deletingId === selectedId
                        ? "Click again to delete"
                        : "Delete reminder"
                    }
                    className={`flex size-10 items-center justify-center rounded-xl border border-white/10 transition ${
                      deletingId === selectedId
                        ? "text-red-400"
                        : "text-white/45 hover:border-red-400/30 hover:text-red-300"
                    }`}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-5"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v5" />
                      <path d="M14 11v5" />
                    </svg>
                  </button>
                </>
              ) : null}
            </div>
            </fieldset>
          </form>
            </>
          )}
        </section>

        <section className="surface rounded-2xl p-5">
          <h2 className="text-base font-semibold text-white">Coming up</h2>
          <div className="mt-3 space-y-2">
            {upcoming.length ? (
              upcoming.map((reminder) => (
                <button
                  type="button"
                  key={reminder.id}
                  onClick={() => selectReminder(reminder)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">
                      {reminder.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-white/45">
                      {friendlyDate(reminder.due_date)} · {timingLabel(reminder)}
                      {reminder.recurrence_frequency !== "none"
                        ? ` · Repeats ${recurrenceLabel(
                            reminder.recurrence_frequency,
                            reminder.custom_recurrence_type,
                            reminder.custom_recurrence_value,
                          )}`
                        : ""}
                    </span>
                  </span>
                  {reminder.amount ? (
                    <span className="shrink-0 text-sm font-semibold text-accent">
                      {currency(reminder.amount)}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="text-sm text-white/45">No upcoming reminders yet.</p>
            )}
          </div>
        </section>
      </aside>
      </div>
    </>
  );
}
