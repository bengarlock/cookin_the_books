"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useDefaultAccountNames } from "@/components/account-names";
import { useOptionalBudgetData } from "@/components/budget-data-provider";
import {
  accountDisplayName,
  accountLinkAccounts,
  type AccountDisplayNames,
  type AccountLoginUrls,
} from "@/lib/account-links";
import type { BudgetPlanSettings } from "@/lib/budget-plan-settings-types";
import { APP_BASE_PATH } from "@/lib/config";

const inputClass = "min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-accent/60";
const resetClass = "rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/70 transition hover:border-accent/40 hover:text-white focus-visible:outline-2 focus-visible:outline-accent";

function settingsError(data: Record<string, unknown>, defaultNames: AccountDisplayNames) {
  for (const field of ["account_display_names", "account_login_urls"]) {
    const details = data[field];
    if (details && typeof details === "object") {
      return Object.entries(details).map(([key, value]) => {
        const label = accountLinkAccounts.some((account) => account.key === key)
          ? accountDisplayName(key as keyof AccountDisplayNames, defaultNames)
          : key;
        return `${label}: ${Array.isArray(value) ? value.join(" ") : value}`;
      }).join(" ");
    }
  }
  return typeof data.message === "string" ? data.message : "Account settings could not be saved. Please try again.";
}

export function AccountLinkSettings({ initialSettings }: { initialSettings: BudgetPlanSettings }) {
  const router = useRouter();
  const budgetData = useOptionalBudgetData();
  const defaultNames = useDefaultAccountNames();
  const [urls, setUrls] = useState<AccountLoginUrls>(initialSettings.account_login_urls ?? {});
  const [names, setNames] = useState<AccountDisplayNames>(initialSettings.account_display_names ?? {});
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  function clearFeedback() {
    setStatus("");
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    clearFeedback();
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/budget-plan-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_login_urls: urls, account_display_names: names }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(settingsError(data, defaultNames));
      if (!data.account_login_urls || !data.account_display_names) {
        throw new Error("Account settings could not be saved. Please try again.");
      }
      setUrls(data.account_login_urls);
      setNames(data.account_display_names);
      budgetData?.setBudgetPlanSettings(data);
      setStatus("Account settings saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Account settings could not be saved. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">Account names &amp; links</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Choose a display name and bank portal URL for each account. Your preferences are saved across devices.
        Leave a display name blank to use its default. Leave a URL blank to hide the account’s bank portal button.
      </p>
      <form className="mt-6 space-y-5" onSubmit={save}>
        <fieldset className="space-y-6 disabled:opacity-60" disabled={isSaving}>
          <legend className="sr-only">Account names and bank portal URLs</legend>
          {accountLinkAccounts.filter((account) => account.key !== "citi_pending").map((builtIn) => ({
            ...builtIn,
            label: accountDisplayName(builtIn.key, defaultNames),
          })).map((account) => (
            <div className="max-w-3xl space-y-3 border-b border-white/10 pb-5" key={account.key}>
              <h3 className="text-sm font-semibold text-white">{account.label}</h3>
              <div>
                <label className="block text-xs text-white/65" htmlFor={`account-name-${account.key}`}>
                  Display name<span className="sr-only"> for {account.label}</span>
                </label>
                <div className="mt-1.5 flex items-start gap-2">
                  <input
                    autoComplete="off"
                    className={inputClass}
                    id={`account-name-${account.key}`}
                    maxLength={100}
                    onChange={(event) => {
                      setNames((current) => ({ ...current, [account.key]: event.target.value }));
                      clearFeedback();
                    }}
                    placeholder={account.label}
                    type="text"
                    value={names[account.key] ?? ""}
                  />
                  <button
                    aria-label={`Reset ${account.label} name`}
                    className={resetClass}
                    onClick={() => {
                      setNames((current) => { const next = { ...current }; delete next[account.key]; return next; });
                      clearFeedback();
                    }}
                    type="button"
                  >Reset</button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/65" htmlFor={`account-link-${account.key}`}>
                  Bank portal URL<span className="sr-only"> for {account.label}</span>
                </label>
                <div className="mt-1.5 flex items-start gap-2">
                  <input
                    autoComplete="off"
                    className={inputClass}
                    id={`account-link-${account.key}`}
                    maxLength={2000}
                    onChange={(event) => {
                      setUrls((current) => ({ ...current, [account.key]: event.target.value }));
                      clearFeedback();
                    }}
                    placeholder="https://example.com"
                    type="url"
                    value={urls[account.key] ?? ""}
                  />
                  <button
                    aria-label={`Clear ${account.label} link`}
                    className={resetClass}
                    onClick={() => {
                      setUrls((current) => { const next = { ...current }; delete next[account.key]; return next; });
                      clearFeedback();
                    }}
                    type="button"
                  >Clear</button>
                </div>
              </div>
            </div>
          ))}
        </fieldset>
        <div aria-live="polite" className="min-h-5 text-sm">
          {error ? <p className="text-red-300" role="alert">{error}</p> : <p className="text-emerald-300" role="status">{status}</p>}
        </div>
        <button className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50" disabled={isSaving} type="submit">
          {isSaving ? "Saving…" : "Save account settings"}
        </button>
      </form>
    </section>
  );
}
