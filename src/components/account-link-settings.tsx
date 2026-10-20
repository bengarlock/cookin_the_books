"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { accountLinkAccounts, defaultAccountLoginUrls, type AccountLoginUrls } from "@/lib/account-links";
import type { BudgetPlanSettings } from "@/lib/budget-plan-settings-types";
import { APP_BASE_PATH } from "@/lib/config";
import { useOptionalBudgetData } from "@/components/budget-data-provider";

export function AccountLinkSettings({ initialSettings }: { initialSettings: BudgetPlanSettings }) {
  const router = useRouter();
  const budgetData = useOptionalBudgetData();
  const [urls, setUrls] = useState<AccountLoginUrls>(initialSettings.account_login_urls ?? {});
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/budget-plan-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_login_urls: urls }),
      });
      const data = await response.json();
      if (!response.ok) {
        const details = data.account_login_urls;
        const message = details && typeof details === "object"
          ? Object.entries(details).map(([key, value]) => `${accountLinkAccounts.find((account) => account.key === key)?.label ?? key}: ${Array.isArray(value) ? value.join(" ") : value}`).join(" ")
          : data.message;
        throw new Error(message || "Account links could not be saved. Please try again.");
      }
      if (!data.account_login_urls) throw new Error("Account links could not be saved. Please try again.");
      setUrls(data.account_login_urls);
      budgetData?.setBudgetPlanSettings(data);
      setStatus("Account links saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Account links could not be saved. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">Account links</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Choose where each account’s bank portal button opens. These links are saved to your profile across devices.
        Leave a field blank to use its default. Use Reset to restore an account’s default link.
      </p>
      <form className="mt-6 space-y-5" onSubmit={save}>
        <fieldset className="space-y-5 disabled:opacity-60" disabled={isSaving}>
          <legend className="sr-only">Bank portal URLs</legend>
          {accountLinkAccounts.filter((account) => account.key !== "citi_pending").map((account) => (
            <div className="max-w-3xl" key={account.key}>
              <label className="block text-sm text-white/75" htmlFor={`account-link-${account.key}`}>{account.label}</label>
              <div className="mt-1.5 flex items-start gap-2">
                <input
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-accent/60"
                  id={`account-link-${account.key}`}
                  maxLength={2000}
                  onChange={(event) => { setUrls((current) => ({ ...current, [account.key]: event.target.value })); setStatus(""); setError(""); }}
                  placeholder={defaultAccountLoginUrls[account.key] ?? "https://example.com"}
                  type="url"
                  value={urls[account.key] ?? ""}
                />
                <button
                  aria-label={`Reset ${account.label} link`}
                  className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/70 transition hover:border-accent/40 hover:text-white focus-visible:outline-2 focus-visible:outline-accent"
                  onClick={() => { setUrls((current) => { const next = { ...current }; delete next[account.key]; return next; }); setStatus(""); setError(""); }}
                  type="button"
                >Reset</button>
              </div>
            </div>
          ))}
        </fieldset>
        <div aria-live="polite" className="min-h-5 text-sm">
          {error ? <p className="text-red-300" role="alert">{error}</p> : <p className="text-emerald-300" role="status">{status}</p>}
        </div>
        <button className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50" disabled={isSaving} type="submit">
          {isSaving ? "Saving…" : "Save account links"}
        </button>
      </form>
    </section>
  );
}
