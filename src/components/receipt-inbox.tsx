"use client";

import { useEffect, useState } from "react";

import { APP_BASE_PATH } from "@/lib/config";

type ReceiptMailboxSettings = {
  forwarding_from_address: string;
  mailbox_address: string;
};

type ReceiptEmail = {
  id: number;
  sender: string;
  subject: string;
  received_at: string | null;
  parser: string;
  status: "received" | "processed" | "parsed" | "matched" | "review" | "failed";
  error_message: string;
  review_note: string;
  receipt_order: {
    vendor_key: string;
    merchant_name: string;
    external_order_id: string;
    total_amount: string;
    currency: string;
    items: { id: number; name: string; quantity: number }[];
  } | null;
};

type ReviewTransaction = {
  id: number;
  description: string;
  amount: string;
  transaction_date: string;
  issuer: string;
  account_last_four: string;
  pending: boolean;
};

type ReceiptReview = {
  receipt: ReceiptEmail;
  body_text: string;
  transactions: ReviewTransaction[];
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

function formatReceiptTotal(amount: string, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(value);
  } catch {
    return amount;
  }
}

export function ReceiptInbox() {
  const [receipts, setReceipts] = useState<ReceiptEmail[]>([]);
  const [mailboxSettings, setMailboxSettings] = useState<ReceiptMailboxSettings | null>(null);
  const [forwardingFromAddress, setForwardingFromAddress] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [retryingReceiptId, setRetryingReceiptId] = useState<number | null>(null);
  const [deletingReceiptId, setDeletingReceiptId] = useState<number | null>(null);
  const [openingReviewId, setOpeningReviewId] = useState<number | null>(null);
  const [matchingTransactionId, setMatchingTransactionId] = useState<number | null>(null);
  const [review, setReview] = useState<ReceiptReview | null>(null);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadReceipts() {
      try {
        const [receiptsResponse, settingsResponse] = await Promise.all([
          fetch(`${APP_BASE_PATH}/api/receipt-emails`, { cache: "no-store" }),
          fetch(`${APP_BASE_PATH}/api/receipt-mailbox-settings`, { cache: "no-store" }),
        ]);
        const data = await receiptsResponse.json().catch(() => null) as ReceiptEmail[] | { results?: ReceiptEmail[]; message?: string } | null;
        const settingsData = await settingsResponse.json().catch(() => null) as ReceiptMailboxSettings | { message?: string } | null;
        if (!receiptsResponse.ok) throw new Error(data && "message" in data ? data.message : "Receipt emails could not be loaded.");
        if (!settingsResponse.ok || !settingsData || !("forwarding_from_address" in settingsData)) {
          throw new Error(settingsData && "message" in settingsData ? settingsData.message : "Receipt mailbox settings could not be loaded.");
        }
        const nextReceipts = Array.isArray(data) ? data : data?.results || [];
        if (!cancelled) {
          setReceipts(nextReceipts);
          setMailboxSettings(settingsData);
          setForwardingFromAddress(settingsData.forwarding_from_address);
        }
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

  async function saveForwardingAddress() {
    setSavingAddress(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/receipt-mailbox-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forwarding_from_address: forwardingFromAddress.trim() }),
      });
      const data = await response.json().catch(() => null) as ReceiptMailboxSettings | { message?: string } | null;
      if (!response.ok || !data || !("forwarding_from_address" in data)) {
        throw new Error(data && "message" in data ? data.message : "The forwarding address could not be saved.");
      }
      setMailboxSettings(data);
      setForwardingFromAddress(data.forwarding_from_address);
      setStatus("Forwarding address saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The forwarding address could not be saved.");
    } finally {
      setSavingAddress(false);
    }
  }

  async function retryMatching(receipt: ReceiptEmail) {
    setRetryingReceiptId(receipt.id);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/receipt-emails/${receipt.id}/retry-match`, {
        method: "POST",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null) as ReceiptEmail | { message?: string } | null;
      if (!response.ok || !data || !("id" in data)) {
        throw new Error(data && "message" in data ? data.message : "The receipt could not be matched again.");
      }
      setReceipts((current) => current.map((item) => item.id === data.id ? data : item));
      setStatus(data.status === "matched" ? "Receipt matched to a transaction." : "No matching transaction was found yet.");
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "The receipt could not be matched again.");
    } finally {
      setRetryingReceiptId(null);
    }
  }

  async function deleteReceipt(receipt: ReceiptEmail) {
    if (!window.confirm("Delete this forwarded receipt record? This will not delete an attached order or card transaction.")) return;
    setDeletingReceiptId(receipt.id);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/receipt-emails/${receipt.id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(data?.message || "The receipt could not be deleted.");
      }
      setReceipts((current) => current.filter((item) => item.id !== receipt.id));
      setStatus("Receipt deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The receipt could not be deleted.");
    } finally {
      setDeletingReceiptId(null);
    }
  }

  async function openReview(receipt: ReceiptEmail) {
    setOpeningReviewId(receipt.id);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/receipt-emails/${receipt.id}/review`, { cache: "no-store" });
      const data = await response.json().catch(() => null) as ReceiptReview | { message?: string } | null;
      if (!response.ok || !data || !("receipt" in data)) {
        throw new Error(data && "message" in data ? data.message : "The receipt review could not be loaded.");
      }
      setReview(data);
      setTransactionSearch("");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "The receipt review could not be loaded.");
    } finally {
      setOpeningReviewId(null);
    }
  }

  async function manuallyMatchReceipt(transaction: ReviewTransaction) {
    if (!review) return;
    setMatchingTransactionId(transaction.id);
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/receipt-emails/${review.receipt.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: transaction.id }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => null) as ReceiptEmail | { message?: string } | null;
      if (!response.ok || !data || !("id" in data)) {
        throw new Error(data && "message" in data ? data.message : "The receipt could not be matched manually.");
      }
      setReceipts((current) => current.map((item) => item.id === data.id ? data : item));
      setReview(null);
      setStatus("Receipt manually matched to the selected transaction.");
    } catch (matchError) {
      setError(matchError instanceof Error ? matchError.message : "The receipt could not be matched manually.");
    } finally {
      setMatchingTransactionId(null);
    }
  }

  const reviewTransactions = review?.transactions.filter((transaction) => {
    const query = transactionSearch.trim().toLowerCase();
    return !query || [
      transaction.description,
      transaction.amount,
      transaction.transaction_date,
      transaction.account_last_four,
    ].some((value) => value.toLowerCase().includes(query));
  }) || [];

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Receipt inbox</p>
        <h2 className="mt-2 text-lg font-semibold text-white">Forward receipts</h2>
        <p className="mt-1 text-sm text-muted">Send receipt emails to <span className="font-medium text-foreground">receipts@bengarlock.com</span>. New messages are checked automatically and matched to card transactions.</p>
      </div>
      {error ? <p className="border-b border-rose-300/15 bg-rose-300/10 px-5 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <div className="divide-y divide-line/70">
        <div className="border-b border-line/70 p-5 sm:p-6">
          <label className="block text-sm font-medium text-foreground" htmlFor="receipt-forwarding-address">
            Your forwarding address
          </label>
          <p className="mt-1 text-xs text-muted">
            We use the sender address from forwarded messages to assign receipts to your account.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="min-h-10 flex-1 rounded-lg border border-line bg-transparent px-3 text-sm text-foreground outline-none focus:border-accent/60"
              id="receipt-forwarding-address"
              onChange={(event) => setForwardingFromAddress(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={forwardingFromAddress}
            />
            <button
              className="min-h-10 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#07100f] disabled:opacity-50"
              disabled={savingAddress || !forwardingFromAddress.trim() || !mailboxSettings}
              onClick={() => void saveForwardingAddress()}
              type="button"
            >
              {savingAddress ? "Saving..." : "Save address"}
            </button>
          </div>
          {status ? <p className="mt-2 text-xs text-accent" role="status">{status}</p> : null}
        </div>
        {receipts.length ? receipts.slice(0, 8).map((receipt) => (
          <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" key={receipt.id}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {receipt.receipt_order?.merchant_name || receipt.subject || "Receipt email"}
              </p>
              <p className="mt-1 truncate text-xs text-muted">{receipt.sender || "Unknown sender"}{receipt.received_at ? ` · ${new Date(receipt.received_at).toLocaleString()}` : ""}</p>
              {receipt.receipt_order ? <p className="mt-1 text-xs text-muted">Order {receipt.receipt_order.external_order_id} · {formatReceiptTotal(receipt.receipt_order.total_amount, receipt.receipt_order.currency)} · {receipt.receipt_order.items.length} item{receipt.receipt_order.items.length === 1 ? "" : "s"}</p> : null}
              {receipt.review_note || receipt.error_message ? <p className="mt-1 text-xs text-amber-300">{receipt.review_note || receipt.error_message}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {receipt.status === "parsed" && receipt.receipt_order ? (
                <button
                  className="min-w-32 rounded-lg border border-accent/40 px-3 py-2 text-xs font-semibold text-accent transition hover:border-accent hover:bg-accent/10 disabled:opacity-50"
                  disabled={retryingReceiptId !== null}
                  onClick={() => void retryMatching(receipt)}
                  type="button"
                >
                  {retryingReceiptId === receipt.id ? "Retrying..." : "Retry matching"}
                </button>
              ) : null}
              {(["review", "failed", "parsed"] as ReceiptEmail["status"][]).includes(receipt.status) ? (
                <button
                  aria-label={openingReviewId === receipt.id ? "Opening receipt review" : "Review receipt"}
                  className="flex size-9 items-center justify-center rounded-lg border border-accent/40 text-accent transition hover:border-accent hover:bg-accent/10 disabled:opacity-50"
                  disabled={openingReviewId !== null || deletingReceiptId !== null || retryingReceiptId !== null}
                  onClick={() => void openReview(receipt)}
                  title="Review receipt"
                  type="button"
                >
                  {openingReviewId === receipt.id ? <span className="text-xs">...</span> : (
                    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  )}
                </button>
              ) : null}
              <button
                aria-label={deletingReceiptId === receipt.id ? "Deleting receipt" : "Delete receipt"}
                className="flex size-9 items-center justify-center rounded-lg border border-rose-300/35 text-rose-200 transition hover:border-rose-300 hover:bg-rose-300/10 disabled:opacity-50"
                disabled={deletingReceiptId !== null || retryingReceiptId !== null}
                onClick={() => void deleteReceipt(receipt)}
                title="Delete receipt"
                type="button"
              >
                {deletingReceiptId === receipt.id ? <span className="text-xs">...</span> : (
                  <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              {receipt.status === "matched" ? (
                <span aria-label="Matched" className="flex size-8 items-center justify-center rounded-full border border-accent/35 text-accent" title="Matched">
                  <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : receipt.status === "review" ? (
                <span aria-label="Needs review" className="flex size-8 items-center justify-center rounded-full border border-amber-300/35 text-amber-300" title="Needs review">
                  <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M12 3 2.8 20h18.4L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 9v4m0 4h.01" strokeLinecap="round" />
                  </svg>
                </span>
              ) : (
                <span className={`text-xs font-semibold ${receipt.status === "failed" ? "text-rose-300" : "text-amber-300"}`}>
                  {statusLabel(receipt.status)}
                </span>
              )}
            </div>
          </div>
        )) : (
          <p className="px-5 py-5 text-sm text-muted sm:px-6">No forwarded receipts have been processed yet.</p>
        )}
      </div>
      {review ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog">
          <div className="surface flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line shadow-2xl">
            <div className="flex items-start justify-between border-b border-line/70 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Receipt review</p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">{review.receipt.subject || "Forwarded receipt"}</h3>
                <p className="mt-1 text-sm text-amber-300">{review.receipt.review_note || review.receipt.error_message || "Choose the transaction this receipt belongs to."}</p>
              </div>
              <button className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-muted hover:text-foreground" onClick={() => setReview(null)} type="button">Close</button>
            </div>
            <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Forwarded email</h4>
                <pre className="mt-3 max-h-[52vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-black/20 p-4 text-xs leading-5 text-muted">{review.body_text || "No plain-text receipt body was saved."}</pre>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Choose a card transaction</h4>
                <p className="mt-1 text-xs text-muted">Manual matching uses the selected transaction’s amount and date. It does not modify the transaction.</p>
                <input
                  className="mt-3 min-h-10 w-full rounded-lg border border-line bg-transparent px-3 text-sm text-foreground outline-none focus:border-accent/60"
                  onChange={(event) => setTransactionSearch(event.target.value)}
                  placeholder="Search description, amount, date, or card"
                  value={transactionSearch}
                />
                <div className="mt-3 max-h-[43vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
                  {reviewTransactions.length ? reviewTransactions.map((transaction) => (
                    <div className="flex items-center justify-between gap-3 p-3" key={transaction.id}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{transaction.description}</p>
                        <p className="mt-1 text-xs text-muted">{transaction.transaction_date} · {transaction.issuer} · •••• {transaction.account_last_four}{transaction.pending ? " · Pending" : ""}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-semibold text-foreground">{formatReceiptTotal(transaction.amount, "USD")}</span>
                        <button
                          className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[#07100f] disabled:opacity-50"
                          disabled={matchingTransactionId !== null}
                          onClick={() => void manuallyMatchReceipt(transaction)}
                          type="button"
                        >
                          {matchingTransactionId === transaction.id ? "Matching..." : "Match"}
                        </button>
                      </div>
                    </div>
                  )) : <p className="p-4 text-sm text-muted">No matching transactions in the recent purchase list.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
