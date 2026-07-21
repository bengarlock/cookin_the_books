"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";

import { AutomationSelectorBuilder } from "@/components/automation-selector-builder";
import type { CreditCardTransaction } from "@/lib/credit-card-transaction-types";
import type { ExpenseAutomationCondition } from "@/lib/expense-automation-rule-types";
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

export function ReportsDashboard({ transactions }: { transactions: CreditCardTransaction[] }) {
  const [conditions, setConditions] = useState<ExpenseAutomationCondition[]>([]);
  const [results, setResults] = useState<CreditCardTransaction[] | null>(null);
  const [stale, setStale] = useState(false);
  const savedReports = useSyncExternalStore(subscribeSavedReports, readSavedReports, () => emptySavedReports);
  const [reportName, setReportName] = useState("");
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const accounts = useMemo(() => Array.from(new Map(transactions
    .filter((item) => /^\d{4}$/.test(item.account_last_four))
    .map((item) => [item.account_last_four, `${item.issuer} •••• ${item.account_last_four}`])), ([value, label]) => ({ value, label })), [transactions]);
  const descriptions = useMemo(() => Array.from(new Set(transactions.map((item) => item.description).filter(Boolean))).sort(), [transactions]);
  const tags = useMemo(() => Array.from(new Set(transactions.flatMap((item) => item.tags?.map((tag) => tag.name) || []))).sort(), [transactions]);
  const preview = useMemo(() => selectTransactions(transactions, conditions, "and"), [transactions, conditions]);

  function changeConditions(next: ExpenseAutomationCondition[]) { setConditions(next); if (results) setStale(true); setSaveMessage(""); setSaveError(""); }
  function runReport() { setResults(preview); setStale(false); }
  function resetReportForm() { setActiveReportId(null); setReportName(""); setSaveMessage(""); setSaveError(""); }

  function saveReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = reportName.trim();
    if (!name || !conditions.length || conditions.some(conditionIsEmpty)) {
      setSaveError("Enter a report name and at least one complete selector.");
      setSaveMessage("");
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
    setSaveMessage(`${savedReport.name} saved.`);
  }

  function loadReport(report: SavedReport, run = false) {
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
    setStale(false);
    setResults(run ? selectTransactions(transactions, report.conditions, "and") : null);
  }

  function deleteReport(reportId: string) {
    const next = savedReports.filter((report) => report.id !== reportId);
    writeSavedReports(next);
    setPendingDeleteId(null);
    if (activeReportId === reportId) resetReportForm();
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

  return <div className="space-y-6">
    <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Report criteria</p><h2 className="mt-2 text-xl font-semibold text-white">What would you like to analyze?</h2><p className="mt-1 text-sm text-muted">Build a reusable slice of your transaction history with the same selectors used by automations.</p></div>
        <div className="flex flex-wrap gap-2">
          {activeReportId ? <button className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70" onClick={resetReportForm} type="button">New report</button> : null}
          <button className="rounded-xl border border-accent/30 bg-accent/15 px-5 py-2.5 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-40" disabled={!conditions.length || conditions.some(conditionIsEmpty)} onClick={runReport} type="button">Run report →</button>
        </div>
      </div>
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <form className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/10 p-3 sm:flex-row sm:items-center" onSubmit={saveReport}>
          <input
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-accent/40"
            onChange={(event) => { setReportName(event.target.value); setSaveMessage(""); setSaveError(""); }}
            placeholder="Report name"
            value={reportName}
          />
          <button className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold disabled:cursor-not-allowed disabled:opacity-40" disabled={!conditions.length || conditions.some(conditionIsEmpty)} type="submit">
            {activeReportId ? "Update report" : "Save report"}
          </button>
          {saveMessage || saveError ? <p className={`text-xs ${saveError ? "text-rose-200" : "text-accent"}`}>{saveError || saveMessage}</p> : null}
        </form>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold">Saved reports</p>
          <div className="mt-3 space-y-2">
            {savedReports.map((report) => (
              <div className={`rounded-xl border p-2 ${activeReportId === report.id ? "border-accent/25 bg-accent/[0.06]" : "border-white/10 bg-white/[0.025]"}`} key={report.id}>
                <div className="flex items-start justify-between gap-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => loadReport(report)} type="button">
                    <span className="block truncate text-sm font-medium text-white/85">{report.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">{report.conditions.length} {report.conditions.length === 1 ? "selector" : "selectors"}</span>
                  </button>
                  <button className="rounded-md border border-accent/25 px-2 py-1 text-[11px] font-semibold text-accent" onClick={() => loadReport(report, true)} type="button">Run</button>
                </div>
                <div className="mt-2 flex justify-end">
                  <button className="min-w-16 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/55 hover:text-rose-200" onClick={() => pendingDeleteId === report.id ? deleteReport(report.id) : setPendingDeleteId(report.id)} type="button">
                    {pendingDeleteId === report.id ? "Confirm" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
            {!savedReports.length ? <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-muted">No saved reports yet.</p> : null}
          </div>
        </div>
      </div>
      <AutomationSelectorBuilder accounts={accounts} conditions={conditions} descriptions={descriptions} tags={tags} logic="and" matches={preview} onChange={changeConditions} />
    </section>

    {results ? <>
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
    </> : <section className="rounded-3xl border border-dashed border-white/15 bg-black/10 px-6 py-14 text-center"><p className="text-lg font-medium text-white/75">Your report will appear here</p><p className="mt-2 text-sm text-muted">Add at least one selector, then run the report.</p></section>}
  </div>;
}

function Metric({ label, value, detail, tone = "accent" }: { label: string; value: string; detail: string; tone?: "accent" | "rose" }) { return <div className="dashboard-tile dashboard-tile-featured rounded-2xl border border-white/10 bg-white/[0.025] p-5"><p className="dashboard-tile-label text-xs uppercase tracking-[0.14em] text-muted">{label}</p><p className={`dashboard-tile-value mt-2 text-2xl font-semibold ${tone === "rose" ? "dashboard-tile-value-negative text-rose-200" : "dashboard-tile-value-featured text-accent"}`}>{value}</p><p className="dashboard-tile-description mt-1 text-xs text-muted">{detail}</p></div>; }
function CategoryRow({ category, total }: { category: { name: string; cost: number }; total: number }) { const share = total ? (category.cost / total) * 100 : 0; return <div><div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="truncate text-white/80">{category.name}</span><span className="whitespace-nowrap font-mono text-white">{money.format(category.cost)} <span className="ml-1 text-xs text-muted">{share.toFixed(1)}%</span></span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(1, share)}%` }} /></div></div>; }
function Empty() { return <div className="grid min-h-28 place-items-center text-sm text-muted">No matching data.</div>; }
