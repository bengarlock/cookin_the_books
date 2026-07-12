"use client";

import { useState } from "react";

import { APP_BASE_PATH } from "@/lib/config";
import type {
  CreditCardTransaction,
  RelatedTransaction,
} from "@/lib/credit-card-transaction-types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function transactionDetail(
  transaction: CreditCardTransaction | RelatedTransaction,
) {
  return `${dateFormatter.format(new Date(`${transaction.transaction_date}T12:00:00`))} · ${transaction.issuer} •••• ${transaction.account_last_four} · ${currencyFormatter.format(Number(transaction.amount))}`;
}

export function TransactionRelationshipEditor({
  onUpdated,
  transaction,
}: {
  onUpdated: (transaction: CreditCardTransaction) => void;
  transaction: CreditCardTransaction;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CreditCardTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function search() {
    const cleaned = query.trim();
    if (!cleaned) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        include_unbudgeted: "true",
        search: cleaned,
        exclude_id: String(transaction.id),
        limit: "10",
      });
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => null)) as
        | CreditCardTransaction[]
        | { message?: string }
        | null;
      if (!response.ok || !Array.isArray(data)) {
        throw new Error(
          data && !Array.isArray(data)
            ? data.message
            : "Unable to search transactions.",
        );
      }
      setResults(data);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Unable to search transactions.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateRelationship(
    relatedTransactionId: number,
    method: "POST" | "DELETE",
  ) {
    setSavingId(relatedTransactionId);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/relationships`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            related_transaction_id: relatedTransactionId,
          }),
        },
      );
      const updated = (await response.json().catch(() => null)) as
        | CreditCardTransaction
        | { detail?: string; message?: string }
        | null;
      if (!response.ok || !updated || !("id" in updated)) {
        throw new Error(
          updated && "message" in updated
            ? updated.message
            : updated && "detail" in updated
              ? updated.detail
              : "Unable to update this relationship.",
        );
      }
      setResults((current) =>
        current.filter((item) => item.id !== relatedTransactionId),
      );
      onUpdated(updated);
    } catch (relationshipError) {
      setError(
        relationshipError instanceof Error
          ? relationshipError.message
          : "Unable to update this relationship.",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="border-t border-white/[0.07] bg-black/10 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        Related transactions
      </p>
      {transaction.related_transactions?.length ? (
        <div className="mt-2 space-y-2">
          {transaction.related_transactions.map((related) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] px-3 py-2"
              key={related.id}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white">
                  {related.description}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {transactionDetail(related)}
                </p>
              </div>
              <button
                className="text-xs text-rose-200 disabled:opacity-50"
                disabled={savingId === related.id}
                onClick={() =>
                  void updateRelationship(related.id, "DELETE")
                }
                type="button"
              >
                Unlink
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">No related transactions yet.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className="h-9 min-w-64 flex-1 rounded-lg border border-white/10 bg-[#0b1714] px-3 text-xs text-white outline-none focus:border-accent/50"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void search();
            }
          }}
          placeholder="Search merchant, amount, account, or YYYY-MM-DD"
          value={query}
        />
        <button
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 disabled:opacity-50"
          disabled={loading || !query.trim()}
          onClick={() => void search()}
          type="button"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
      {results.length ? (
        <div className="mt-2 space-y-2">
          {results.map((result) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-accent/10 bg-accent/[0.03] px-3 py-2"
              key={result.id}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white">
                  {result.description}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {transactionDetail(result)}
                </p>
              </div>
              <button
                className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent disabled:opacity-50"
                disabled={savingId === result.id}
                onClick={() => void updateRelationship(result.id, "POST")}
                type="button"
              >
                Link
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
