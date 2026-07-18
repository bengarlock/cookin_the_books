"use client";

import { useEffect, useState } from "react";

import { APP_BASE_PATH } from "@/lib/config";

type ReceiptEmail = {
  id: number;
  sender: string;
  subject: string;
  received_at: string | null;
  parser: string;
  status: "received" | "processed" | "parsed" | "matched" | "review" | "failed";
  error_message: string;
  receipt_order: {
    vendor_key: string;
    merchant_name: string;
    external_order_id: string;
    total_amount: string;
    items: { id: number; name: string; quantity: number }[];
  } | null;
};

function statusLabel(status: ReceiptEmail["status"]) {
  return {
    received: "Received",
    parsed: "Parsed",
    matched: "Matched",
    processed: "Matched",
    review: "Needs review",
    failed: "Failed",
  }[status];
}

export function ReceiptInbox() {
  const [receipts, setReceipts] = useState<ReceiptEmail[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadReceipts() {
      try {
        const response = await fetch(`${APP_BASE_PATH}/api/receipt-emails`, { cache: "no-store" });
        const data = await response.json().catch(() => null) as ReceiptEmail[] | { results?: ReceiptEmail[]; message?: string } | null;
        if (!response.ok) throw new Error(data && "message" in data ? data.message : "Receipt emails could not be loaded.");
        const nextReceipts = Array.isArray(data) ? data : data?.results || [];
        if (!cancelled) setReceipts(nextReceipts);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Receipt emails could not be loaded.");
      }
    }
    void loadReceipts();
    const interval = window.setInterval(() => void loadReceipts(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Receipt inbox</p>
        <h2 className="mt-2 text-lg font-semibold text-white">Forward receipts</h2>
        <p className="mt-1 text-sm text-muted">Send receipt emails to <span className="font-medium text-foreground">receipts@bengarlock.com</span>. New messages are checked automatically and matched to card transactions.</p>
      </div>
      {error ? <p className="border-b border-rose-300/15 bg-rose-300/10 px-5 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <div className="divide-y divide-line/70">
        {receipts.length ? receipts.slice(0, 8).map((receipt) => (
          <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" key={receipt.id}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {receipt.receipt_order?.merchant_name || receipt.subject || "Receipt email"}
              </p>
              <p className="mt-1 truncate text-xs text-muted">{receipt.sender || "Unknown sender"}{receipt.received_at ? ` · ${new Date(receipt.received_at).toLocaleString()}` : ""}</p>
              {receipt.receipt_order ? <p className="mt-1 text-xs text-muted">Order {receipt.receipt_order.external_order_id} · {receipt.receipt_order.items.length} item{receipt.receipt_order.items.length === 1 ? "" : "s"}</p> : null}
              {receipt.error_message ? <p className="mt-1 text-xs text-amber-300">{receipt.error_message}</p> : null}
            </div>
            <span className={`shrink-0 text-xs font-semibold ${receipt.status === "matched" ? "text-accent" : receipt.status === "failed" ? "text-rose-300" : "text-amber-300"}`}>
              {statusLabel(receipt.status)}
            </span>
          </div>
        )) : (
          <p className="px-5 py-5 text-sm text-muted sm:px-6">No forwarded receipts have been processed yet.</p>
        )}
      </div>
    </section>
  );
}
