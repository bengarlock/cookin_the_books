"use client";

import { useState, type FormEvent } from "react";

import { APP_BASE_PATH } from "@/lib/config";
import type { BudgetPlanSettings } from "@/lib/budget-plan-settings-types";

function errorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "The reminder email could not be saved.";
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  for (const value of Object.values(record)) {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return "The reminder email could not be saved.";
}

export function ReminderEmailSetting({
  initialSettings,
}: {
  initialSettings: BudgetPlanSettings;
}) {
  const accountEmail = initialSettings.account_email?.trim() ?? "";
  const [email, setEmail] = useState(
    initialSettings.financial_reminder_email?.trim() ?? "",
  );
  const [savedEmail, setSavedEmail] = useState(email);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function saveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus("");
    setError("");
    const normalizedEmail = email.trim();

    try {
      const response = await fetch(`${APP_BASE_PATH}/api/budget-plan-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financial_reminder_email: normalizedEmail }),
      });
      const data = (await response.json().catch(() => null)) as
        | BudgetPlanSettings
        | unknown;
      if (!response.ok) throw new Error(errorMessage(data));
      const saved = data as BudgetPlanSettings;
      const nextEmail = saved.financial_reminder_email?.trim() ?? "";
      setEmail(nextEmail);
      setSavedEmail(nextEmail);
      setStatus(
        nextEmail
          ? "Reminder email saved."
          : "Calendar reminders will use your account email.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The reminder email could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const currentDestination = savedEmail || accountEmail;

  return (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Notifications
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">
          Calendar reminder email
        </h2>
        <p className="mt-1 text-sm text-muted">
          Choose where financial reminder emails are delivered. This does not
          change the address used to forward receipts.
        </p>
      </div>

      <form className="mt-5 max-w-xl space-y-4" onSubmit={saveEmail}>
        <label className="block text-sm text-white/65" htmlFor="reminder-email">
          Email address
          <input
            autoComplete="email"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none transition placeholder:text-white/25 focus:border-accent/60"
            id="reminder-email"
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
              setStatus("");
            }}
            placeholder={accountEmail || "name@example.com"}
            type="email"
            value={email}
          />
        </label>
        <p className="text-xs text-muted">
          Leave this blank to use your account email
          {accountEmail ? ` (${accountEmail})` : ""}.
        </p>
        {currentDestination ? (
          <p className="text-sm text-white/70">
            Current destination: <span className="text-white">{currentDestination}</span>
          </p>
        ) : (
          <p className="text-sm text-amber-200">
            Add an address before enabling email reminders.
          </p>
        )}
        {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
        {status ? <p className="text-sm text-emerald-300" role="status">{status}</p> : null}
        <button
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving || email.trim() === savedEmail}
          type="submit"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </form>
    </section>
  );
}
