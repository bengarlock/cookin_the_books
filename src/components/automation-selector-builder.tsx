"use client";

import { useState } from "react";

import type { ExpenseAutomationCondition } from "@/lib/expense-automation-rule-types";

const selectors = [
  { field: "description", label: "Description", operators: ["contains", "not_contains", "equals", "not_equals", "starts_with"] },
  { field: "issuer", label: "Issuer", operators: ["contains", "not_contains", "equals", "not_equals", "starts_with"] },
  { field: "transaction_type", label: "Transaction type", operators: ["equals", "not_equals"] },
  { field: "account_last_four", label: "Account", operators: ["equals"] },
  { field: "amount", label: "Amount", operators: ["equals", "greater_than", "less_than"] },
  { field: "transaction_date", label: "Transaction date", operators: ["equals", "on_or_after", "on_or_before"] },
  { field: "tags", label: "Tags", operators: ["contains", "not_contains", "equals"] },
] as const;

const operatorLabels: Record<string, string> = {
  contains: "Contains", not_contains: "Does not contain", equals: "Equals",
  not_equals: "Does not equal", starts_with: "Starts with",
  greater_than: "Greater than", less_than: "Less than",
  on_or_after: "On or after", on_or_before: "On or before",
};

export function AutomationSelectorBuilder({ conditions, logic, accounts, matchCount, onChange, onLogicChange }: {
  conditions: ExpenseAutomationCondition[];
  logic: "and" | "or";
  accounts: Array<{ value: string; label: string }>;
  matchCount: number;
  onChange: (conditions: ExpenseAutomationCondition[]) => void;
  onLogicChange: (logic: "and" | "or") => void;
}) {
  const [search, setSearch] = useState("");

  function addSelector(field: ExpenseAutomationCondition["field"]) {
    const selector = selectors.find((item) => item.field === field)!;
    onChange([...conditions, { id: crypto.randomUUID(), field, operator: selector.operators[0], value: field === "account_last_four" ? [] : "" }]);
  }

  function update(id: string, patch: Partial<ExpenseAutomationCondition>) {
    onChange(conditions.map((condition) => condition.id === id ? { ...condition, ...patch } : condition));
  }

  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
    <div className="min-h-64 rounded-2xl border border-dashed border-white/15 bg-black/10 p-4" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const field = event.dataTransfer.getData("text/plain") as ExpenseAutomationCondition["field"]; if (selectors.some((item) => item.field === field)) addSelector(field); }}>
      <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Staging area</p><p className="mt-1 text-xs text-muted">Drag selectors here or click them in the palette.</p></div><div className="flex items-center gap-2"><div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100" title="Records matching the current selectors"><span aria-hidden="true">◉</span><span>{matchCount}</span><span className="font-normal text-sky-100/65">records</span></div>{conditions.length > 1 ? <div className="flex rounded-lg border border-white/10 p-1"><button className={`rounded px-2 py-1 text-xs ${logic === "and" ? "bg-accent/15 text-accent" : "text-muted"}`} onClick={() => onLogicChange("and")} type="button">AND</button><button className={`rounded px-2 py-1 text-xs ${logic === "or" ? "bg-accent/15 text-accent" : "text-muted"}`} onClick={() => onLogicChange("or")} type="button">OR</button></div> : null}</div></div>
      {conditions.length ? <div className="space-y-3">{conditions.map((condition, index) => {
        const selector = selectors.find((item) => item.field === condition.field)!;
        return <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3" key={condition.id}>
          {index ? <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">{logic}</p> : null}
          <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_minmax(10rem,1fr)_auto]">
            <span className="text-sm font-medium text-white">{selector.label}</span>
            <select className="rounded-lg border border-white/10 bg-[#0b1714] px-3 py-2 text-xs text-white" value={condition.operator} onChange={(event) => update(condition.id, { operator: event.target.value as ExpenseAutomationCondition["operator"] })}>{selector.operators.map((operator) => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}</select>
            {condition.field === "account_last_four" ? <details className="relative"><summary className="cursor-pointer list-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">{Array.isArray(condition.value) && condition.value.length ? `${condition.value.length} selected` : "Select accounts"}</summary><div className="absolute z-20 mt-2 max-h-56 min-w-64 overflow-auto rounded-xl border border-white/15 bg-[#0b1714] p-2 shadow-2xl">{accounts.map((account) => { const selected = Array.isArray(condition.value) && condition.value.includes(account.value); return <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/75 hover:bg-white/[0.05]" key={account.value}><input checked={selected} onChange={() => update(condition.id, { value: selected ? (condition.value as string[]).filter((item) => item !== account.value) : [...(Array.isArray(condition.value) ? condition.value : []), account.value] })} type="checkbox" />{account.label}</label>; })}</div></details> : <input className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-accent/40" onChange={(event) => update(condition.id, { value: event.target.value })} placeholder={condition.field === "transaction_date" ? "YYYY-MM-DD" : "Value"} type={condition.field === "amount" ? "number" : condition.field === "transaction_date" ? "date" : "text"} value={condition.value as string} />}
            <button aria-label={`Remove ${selector.label}`} className="px-2 text-lg text-white/35 hover:text-rose-200" onClick={() => onChange(conditions.filter((item) => item.id !== condition.id))} type="button">×</button>
          </div>
        </div>;
      })}</div> : <div className="grid min-h-44 place-items-center rounded-xl border border-white/[0.06] text-center text-sm text-muted">Drop a selector here to begin.</div>}
    </div>
    <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold">Selectors</p><input className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" onChange={(event) => setSearch(event.target.value)} placeholder="Search selectors" value={search} /><div className="mt-3 space-y-1">{selectors.filter((item) => item.label.toLowerCase().includes(search.toLowerCase())).map((selector) => <button className="flex w-full cursor-grab items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/70 transition hover:bg-accent/10 hover:text-accent" draggable key={selector.field} onClick={() => addSelector(selector.field)} onDragStart={(event) => event.dataTransfer.setData("text/plain", selector.field)} type="button"><span aria-hidden="true">⠿</span>{selector.label}</button>)}</div></aside>
  </div>;
}
