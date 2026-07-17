"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AmazonOrderImport() {
  const router = useRouter();
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
      router.refresh();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Amazon order import failed.");
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Amazon data</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Order history</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">Import Amazon&apos;s Order History.csv to expand matching card transactions into individual products.</p>
        </div>
        <label className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#07100f] transition hover:bg-accent disabled:opacity-60">
          {isImporting ? "Importing…" : "Choose CSV"}
          <input ref={inputRef} accept=".csv,text/csv" className="sr-only" disabled={isImporting} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); }} type="file" />
        </label>
      </div>
      {message ? <p className="border-b border-accent/15 bg-accent/10 px-5 py-3 text-sm text-accent" role="status">{message}</p> : null}
      {error ? <p className="border-b border-rose-300/15 bg-rose-300/10 px-5 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <div className="p-5 sm:p-6">
        <p className="text-xs text-muted">Imported products will appear inside matching transactions on the Accounts and Expenses pages.</p>
      </div>
    </section>
  );
}
