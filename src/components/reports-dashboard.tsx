"use client";

import { useAccountNames } from "@/components/account-names";
import { usePaydayOverrides } from "@/components/payday-overrides";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";

import { AutomationSelectorBuilder } from "@/components/automation-selector-builder";
import { accountSelectorOptions } from "@/lib/account-transaction-filters";
import type { TransactionSelectorRecord } from "@/lib/credit-card-transaction-types";
import type { ExpenseCategory } from "@/lib/expense-category-types";
import type { ExpenseAutomationCondition } from "@/lib/expense-automation-rule-types";
import { labelForCategory } from "@/lib/transaction-categories";
import { conditionIsEmpty, selectTransactions } from "@/lib/transaction-selector";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact" });
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const savedReportsStorageKey = "cookin-the-books-saved-reports";
const savedReportsChangedEvent = "cookin-the-books-saved-reports-changed";
const emptySavedReports: SavedReport[] = [];

type SavedReport = {
  id: string;
  name: string;
  conditions: ExpenseAutomationCondition[];
  createdAt: string;
  updatedAt: string;
};

let savedReportsSnapshotText = "";
let savedReportsSnapshot: SavedReport[] = emptySavedReports;

function readSavedReports() {
  if (typeof window === "undefined") return emptySavedReports;
  const stored = window.localStorage.getItem(savedReportsStorageKey) || "[]";
  if (stored === savedReportsSnapshotText) return savedReportsSnapshot;

  try {
    const parsed = JSON.parse(stored) as SavedReport[];
    savedReportsSnapshot = Array.isArray(parsed)
      ? parsed.filter((report) => report.id && report.name && Array.isArray(report.conditions))
      : emptySavedReports;
  } catch {
    savedReportsSnapshot = emptySavedReports;
  }
  savedReportsSnapshotText = stored;
  return savedReportsSnapshot;
}

function writeSavedReports(reports: SavedReport[]) {
  window.localStorage.setItem(savedReportsStorageKey, JSON.stringify(reports));
  window.dispatchEvent(new Event(savedReportsChangedEvent));
}

function subscribeSavedReports(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(savedReportsChangedEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(savedReportsChangedEvent, onStoreChange);
  };
}

export function ReportsDashboard({
  categories,
  transactions,
}: {
  categories: ExpenseCategory[];
  transactions: TransactionSelectorRecord[];
}) {
  const [view, setView] = useState<"index" | "editor">("index");
  const [editorTab, setEditorTab] = useState<"report" | "setup">("report");
  const [conditions, setConditions] = useState<ExpenseAutomationCondition[]>([]);
  const [results, setResults] = useState<TransactionSelectorRecord[] | null>(
    null,
  );
  const [stale, setStale] = useState(false);
  const savedReports = useSyncExternalStore(subscribeSavedReports, readSavedReports, () => emptySavedReports);
  const [reportName, setReportName] = useState("");
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveButtonState, setSaveButtonState] = useState<"idle" | "saved" | "updated">("idle");
  const saveButtonTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountNames = useAccountNames();
  const accounts = useMemo(
    () => accountSelectorOptions(transactions, { names: accountNames }),
    [accountNames, transactions],
  );
  const categoryOptions = useMemo(() => {
    const options = new Map(
      categories.map((category) => [
        category.key,
        { value: category.key, label: category.label },
      ]),
    );
    transactions.forEach((transaction) => {
      const category = transaction.category?.trim();
      if (!category || options.has(category)) return;
      options.set(category, {
        value: category,
        label: labelForCategory(
          category,
          categories,
          category.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        ),
      });
    });
    return Array.from(options.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [categories, transactions]);
  const descriptions = useMemo(() => Array.from(new Set(transactions.map((item) => item.description).filter(Boolean))).sort(), [transactions]);
  const tags = useMemo(() => Array.from(new Set(transactions.flatMap((item) => item.tags?.map((tag) => tag.name) || []))).sort(), [transactions]);
  const paydayOverrides = usePaydayOverrides();
  const preview = useMemo(() => selectTransactions(transactions, conditions, "and", new Date(), paydayOverrides), [transactions, conditions, paydayOverrides]);

  useEffect(() => () => {
    if (saveButtonTimeout.current) clearTimeout(saveButtonTimeout.current);
  }, []);

  function clearSaveButtonState() {
    if (saveButtonTimeout.current) clearTimeout(saveButtonTimeout.current);
    saveButtonTimeout.current = null;
    setSaveButtonState("idle");
  }

  function showSaveButtonConfirmation(state: "saved" | "updated") {
    clearSaveButtonState();
    setSaveButtonState(state);
    saveButtonTimeout.current = setTimeout(() => {
      setSaveButtonState("idle");
      saveButtonTimeout.current = null;
    }, 2000);
  }

  function changeConditions(next: ExpenseAutomationCondition[]) {
    setConditions(next);
    if (results) setStale(true);
    clearSaveButtonState();
    setSaveError("");
  }

  function runReport() {
    setResults(preview);
    setStale(false);
    setEditorTab("report");
  }

  function startNewReport() {
    setView("editor");
    setEditorTab("setup");
    setConditions([]);
    setResults(null);
    setStale(false);
    setReportName("");
    setActiveReportId(null);
    setPendingDeleteId(null);
    setSaveMessage("");
    setSaveError("");
    clearSaveButtonState();
  }

  function showReportIndex() {
    setView("index");
    setPendingDeleteId(null);
    setSaveMessage("");
    setSaveError("");
    clearSaveButtonState();
  }

  function saveReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = reportName.trim();
    if (!name || !conditions.length || conditions.some(conditionIsEmpty)) {
      setSaveError("Enter a report name and at least one complete selector.");
      clearSaveButtonState();
      return;
    }
    const now = new Date().toISOString();
    const savedConditions = conditions.map((condition) => ({
      ...condition,
      value: Array.isArray(condition.value) ? [...condition.value] : condition.value,
    }));
    const existing = activeReportId
      ? savedReports.find((report) => report.id === activeReportId)
      : null;
    const savedReport: SavedReport = {
      id: existing?.id || crypto.randomUUID(),
      name,
      conditions: savedConditions,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const next = existing
      ? savedReports.map((report) => report.id === savedReport.id ? savedReport : report)
      : [savedReport, ...savedReports];
    const sorted = next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    writeSavedReports(sorted);
    setActiveReportId(savedReport.id);
    setReportName(savedReport.name);
    setSaveError("");
    showSaveButtonConfirmation(existing ? "updated" : "saved");
  }

  function loadReport(report: SavedReport) {
    setView("editor");
    setEditorTab("report");
    setConditions(report.conditions.map((condition) => ({
      ...condition,
      id: condition.id || crypto.randomUUID(),
      value: Array.isArray(condition.value) ? [...condition.value] : condition.value,
    })));
    setReportName(report.name);
    setActiveReportId(report.id);
    setPendingDeleteId(null);
    setSaveError("");
    setSaveMessage("");
    clearSaveButtonState();
    setStale(false);
    setResults(selectTransactions(transactions, report.conditions, "and", new Date(), paydayOverrides));
  }

  function deleteReport(reportId: string) {
    const next = savedReports.filter((report) => report.id !== reportId);
    writeSavedReports(next);
    setPendingDeleteId(null);
    if (activeReportId === reportId) {
      setActiveReportId(null);
      setReportName("");
      setConditions([]);
      setResults(null);
      setStale(false);
    }
    setSaveMessage("Report deleted.");
    setSaveError("");
  }

  const metrics = useMemo(() => {
    if (!results) return null;
    const annual = new Map<number, { total: number; count: number; monthly: number[] }>();
    results.forEach((item) => {
      const year = Number(item.transaction_date.slice(0, 4));
      const month = Number(item.transaction_date.slice(5, 7)) - 1;
      const bucket = annual.get(year) || { total: 0, count: 0, monthly: Array(12).fill(0) };
      bucket.total += Math.abs(Number(item.amount)); bucket.count += 1; bucket.monthly[month] += Math.abs(Number(item.amount)); annual.set(year, bucket);
    });
    const years = Array.from(annual.keys()).sort((a, b) => b - a);
    const currentYear = years[0]; const priorYear = years[1];
    const current = annual.get(currentYear); const prior = annual.get(priorYear);
    const total = results.reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
    const categories = Array.from(results.reduce((items, item) => {
      const name = item.category?.trim() || "Uncategorized";
      items.set(name, (items.get(name) || 0) + Math.abs(Number(item.amount)));
      return items;
    }, new Map<string, number>()), ([name, cost]) => ({ name, cost }))
      .sort((left, right) => right.cost - left.cost);
    return { annual, years, currentYear, priorYear, current, prior, total, categories, average: results.length ? total / results.length : 0, yoy: current && prior && prior.total ? ((current.total - prior.total) / prior.total) * 100 : null };
  }, [results]);

  const maxMonth = metrics ? Math.max(1, ...metrics.years.slice(0, 2).flatMap((year) => metrics.annual.get(year)?.monthly || [])) : 1;

  if (view === "index") {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Reports</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Saved reports</h2>
            <p className="mt-1 text-sm text-muted">Open an existing report to edit its criteria, or start a new report.</p>
          </div>
          <button className="rounded-xl border border-accent/30 bg-accent/15 px-5 py-2.5 text-sm font-semibold text-accent" onClick={startNewReport} type="button">
            Create new report
          </button>
        </div>

        {saveMessage ? <p className="mt-4 rounded-xl border border-accent/20 bg-accent/[0.06] px-4 py-3 text-sm text-accent">{saveMessage}</p> : null}

        {savedReports.length ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {savedReports.map((report) => (
              <article className="flex min-h-44 flex-col rounded-2xl border border-white/10 bg-black/10 p-4" key={report.id}>
                <button className="min-w-0 text-left" onClick={() => loadReport(report)} type="button">
                  <span className="block truncate text-base font-semibold text-white">{report.name}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {report.conditions.length} {report.conditions.length === 1 ? "selector" : "selectors"} · Updated {formatSavedReportDate(report.updatedAt)}
                  </span>
                </button>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <button className="rounded-lg border border-accent/25 bg-accent/[0.06] px-3 py-2 text-xs font-semibold text-accent" onClick={() => loadReport(report)} type="button">
                    Edit report
                  </button>
                  <button className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70" onClick={() => loadReport(report)} type="button">
                    Run report
                  </button>
                  <button className="min-w-24 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 hover:text-rose-200" onClick={() => pendingDeleteId === report.id ? deleteReport(report.id) : setPendingDeleteId(report.id)} type="button">
                    {pendingDeleteId === report.id ? "Confirm delete" : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-black/10 px-6 py-12 text-center">
            <p className="text-lg font-medium text-white/75">No saved reports yet</p>
            <p className="mt-2 text-sm text-muted">Create a report to save a reusable view of your transaction history.</p>
            <button className="mt-5 rounded-xl border border-accent/30 bg-accent/15 px-5 py-2.5 text-sm font-semibold text-accent" onClick={startNewReport} type="button">
              Create your first report
            </button>
          </div>
        )}
      </section>
    );
  }

  return <div className="space-y-6">
    <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <button className="mb-3 text-xs font-semibold text-white/60 hover:text-white" onClick={showReportIndex} type="button">← Saved reports</button>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Report</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{activeReportId ? reportName : "Create a report"}</h2>
          <p className="mt-1 text-sm text-muted">{activeReportId ? "Review the executed report or change its setup and logic." : "Define and save a reusable view of your transaction history."}</p>
        </div>
        {activeReportId ? <button className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70" onClick={startNewReport} type="button">New report</button> : null}
      </div>

      <div aria-label="Report sections" className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/10 p-1 sm:flex sm:w-fit" role="tablist">
        <button
          aria-selected={editorTab === "report"}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${editorTab === "report" ? "bg-accent/15 text-accent" : "text-muted"}`}
          disabled={results === null}
          onClick={() => setEditorTab("report")}
          role="tab"
          type="button"
        >
          Report data
        </button>
        <button
          aria-selected={editorTab === "setup"}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${editorTab === "setup" ? "bg-accent/15 text-accent" : "text-muted"}`}
          onClick={() => setEditorTab("setup")}
          role="tab"
          type="button"
        >
          Setup &amp; logic
        </button>
      </div>
    </section>

    {editorTab === "setup" ? (
      <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Report setup</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Criteria and logic</h2>
            <p className="mt-1 text-sm text-muted">Build the transaction slice with the same selectors used by automations.</p>
          </div>
          <button className="rounded-xl border border-accent/30 bg-accent/15 px-5 py-2.5 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-40" disabled={!conditions.length || conditions.some(conditionIsEmpty)} onClick={runReport} type="button">Run report →</button>
        </div>
        <form className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/10 p-3 sm:flex-row sm:items-center" onSubmit={saveReport}>
          <input
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-accent/40"
            onChange={(event) => { setReportName(event.target.value); clearSaveButtonState(); setSaveError(""); }}
            placeholder="Report name"
            value={reportName}
          />
          <button className="min-w-32 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold disabled:cursor-not-allowed disabled:opacity-40" disabled={!conditions.length || conditions.some(conditionIsEmpty)} type="submit">
            {saveButtonState === "updated" ? "Updated" : saveButtonState === "saved" ? "Saved" : activeReportId ? "Update Report" : "Save Report"}
          </button>
          {saveError ? <p className="text-xs text-rose-200" role="alert">{saveError}</p> : null}
        </form>
        <AutomationSelectorBuilder accounts={accounts} categoryOptions={categoryOptions} conditions={conditions} descriptions={descriptions} tags={tags} logic="and" matches={preview} onChange={changeConditions} />
      </section>
    ) : results ? <>
      {stale ? <div className="rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-sm text-gold">Criteria changed. Run the report again to refresh these results.</div> : null}
      <section className={`grid gap-4 sm:grid-cols-2 ${metrics?.yoy == null ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
        <Metric label="Total cost" value={money.format(metrics?.total || 0)} detail={`${results.length} matching transactions`} />
        <Metric label="Average transaction" value={money.format(metrics?.average || 0)} detail="Across all matching history" />
        <Metric label={metrics?.currentYear ? `${metrics.currentYear} cost` : "Latest year"} value={money.format(metrics?.current?.total || 0)} detail={`${metrics?.current?.count || 0} transactions`} />
        {metrics?.yoy != null ? <Metric label="Year over year" value={`${metrics.yoy >= 0 ? "+" : ""}${metrics.yoy.toFixed(1)}%`} detail={`Compared with ${metrics.priorYear}`} tone={metrics.yoy > 0 ? "rose" : "accent"} /> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Monthly spend</p><h2 className="mt-2 text-xl font-semibold text-white">Year-over-year trend</h2>
          {metrics?.years.length ? <div className="mt-7 grid h-64 grid-cols-12 gap-2">{months.map((month, index) => <div className="flex min-w-0 flex-col justify-end gap-1" key={month}>{metrics.years.slice(0, 2).reverse().map((year, yearIndex) => <div className={`w-full rounded-t ${yearIndex ? "bg-accent" : "bg-gold/60"}`} key={year} style={{ height: `${Math.max(2, ((metrics.annual.get(year)?.monthly[index] || 0) / maxMonth) * 190)}px` }} title={`${month} ${year}: ${money.format(metrics.annual.get(year)?.monthly[index] || 0)}`} />)}<span className="mt-2 truncate text-center text-[10px] text-muted">{month}</span></div>)}</div> : <Empty />}
          <div className="mt-4 flex gap-5 text-xs text-muted">{metrics?.years.slice(0, 2).map((year, index) => <span className="flex items-center gap-2" key={year}><i className={`size-2 rounded-full ${index ? "bg-gold/60" : "bg-accent"}`} />{year}</span>)}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Annual summary</p><h2 className="mt-2 text-xl font-semibold text-white">Cost by year</h2><div className="mt-5 space-y-3">{metrics?.years.map((year) => { const item = metrics.annual.get(year)!; return <div className="rounded-xl border border-white/10 bg-black/10 p-4" key={year}><div className="flex justify-between gap-4"><span className="font-semibold text-white">{year}</span><span className="font-mono text-white">{compactMoney.format(item.total)}</span></div><p className="mt-1 text-xs text-muted">{item.count} transactions · {money.format(item.total / item.count)} average</p></div>; })}{!metrics?.years.length ? <Empty /> : null}</div></div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Category breakdown</p><h2 className="mt-2 text-xl font-semibold text-white">Cost by category</h2>
        <div className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
          {metrics?.categories.map((category) => (
            <CategoryRow category={category} key={category.name} total={metrics.total} />
          ))}
          {!metrics?.categories.length ? <Empty /> : null}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Report detail</p><h2 className="mt-2 text-xl font-semibold text-white">Matching transactions</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wider text-muted"><tr><th className="pb-3">Date</th><th className="pb-3">Description</th><th className="pb-3">Account</th><th className="pb-3">Type</th><th className="pb-3 text-right">Amount</th></tr></thead><tbody>{results.slice().sort((a,b) => b.transaction_date.localeCompare(a.transaction_date)).map((item) => <tr className="border-b border-white/[0.06] text-white/75" key={item.id}><td className="py-3">{date.format(new Date(`${item.transaction_date}T12:00:00`))}</td><td className="max-w-sm truncate py-3 pr-4 text-white">{item.description}</td><td className="py-3">{item.issuer} •••• {item.account_last_four}</td><td className="py-3 capitalize">{item.transaction_type}</td><td className="py-3 text-right font-mono text-white">{money.format(Math.abs(Number(item.amount)))}</td></tr>)}</tbody></table>{!results.length ? <Empty /> : null}</div></section>
    </> : <section className="rounded-3xl border border-dashed border-white/15 bg-black/10 px-6 py-14 text-center"><p className="text-lg font-medium text-white/75">Your report will appear here</p><p className="mt-2 text-sm text-muted">Complete the setup, then run the report.</p></section>}
  </div>;
}

function formatSavedReportDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "recently" : date.format(parsed);
}

function Metric({ label, value, detail, tone = "accent" }: { label: string; value: string; detail: string; tone?: "accent" | "rose" }) { return <div className="dashboard-tile dashboard-tile-featured rounded-2xl border border-white/10 bg-white/[0.025] p-5"><p className="dashboard-tile-label text-xs uppercase tracking-[0.14em] text-muted">{label}</p><p className={`dashboard-tile-value mt-2 text-2xl font-semibold ${tone === "rose" ? "dashboard-tile-value-negative text-rose-200" : "dashboard-tile-value-featured text-accent"}`}>{value}</p><p className="dashboard-tile-description mt-1 text-xs text-muted">{detail}</p></div>; }
function CategoryRow({ category, total }: { category: { name: string; cost: number }; total: number }) { const share = total ? (category.cost / total) * 100 : 0; return <div><div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="truncate text-white/80">{category.name}</span><span className="whitespace-nowrap font-mono text-white">{money.format(category.cost)} <span className="ml-1 text-xs text-muted">{share.toFixed(1)}%</span></span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(1, share)}%` }} /></div></div>; }
function Empty() { return <div className="grid min-h-28 place-items-center text-sm text-muted">No matching data.</div>; }
