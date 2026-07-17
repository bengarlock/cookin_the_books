"use client";

import { useRef, useState } from "react";

export function AmazonOrderImport({ onImported }: { onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function importFile(file: File) {
    setIsImporting(true);
    setMessage("");
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/cookinthebooks/api/amazon-orders/import", { method: "POST", body: formData });
      const result = await response.json().catch(() => null) as { orders?: number; items?: number; matched_orders?: number; message?: string } | null;
      if (!response.ok) throw new Error(result?.message || "Amazon order import failed.");
      setMessage(`${result?.orders || 0} orders and ${result?.items || 0} items imported; ${result?.matched_orders || 0} linked to card transactions.`);
      onImported();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Amazon order import failed.");
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-orange-200/15 bg-orange-100/[0.03] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white/85">Amazon order details</p>
          <p className="mt-1 text-xs text-muted">Import Order History.csv to expand matching card rows into products.</p>
        </div>
        <label className="cursor-pointer rounded-lg border border-orange-200/20 bg-orange-100/[0.06] px-3 py-2 text-xs font-semibold text-orange-100 transition hover:bg-orange-100/10">
          {isImporting ? "Importing…" : "Choose CSV"}
          <input ref={inputRef} accept=".csv,text/csv" className="sr-only" disabled={isImporting} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); }} type="file" />
        </label>
      </div>
      {message ? <p className="mt-2 text-xs text-accent" role="status">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-rose-200" role="alert">{error}</p> : null}
    </div>
  );
}
