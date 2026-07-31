"use client";

import { useState } from "react";

import { AmazonOrderDetails } from "@/components/amazon-order-details";
import { ReceiptOrderDetails } from "@/components/receipt-order-details";
import { APP_BASE_PATH } from "@/lib/config";
import type {
  ExpenseTransaction,
  TransactionOrderDetails,
} from "@/lib/credit-card-transaction-types";

export function MatchedOrderDetails({
  transaction,
}: {
  transaction: ExpenseTransaction;
}) {
  const [details, setDetails] = useState<TransactionOrderDetails | null>(
    transaction.amazon_orders || transaction.receipt_orders
      ? {
          amazon_orders: transaction.amazon_orders || [],
          receipt_orders: transaction.receipt_orders || [],
        }
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (
    !transaction.has_amazon_orders &&
    !transaction.has_receipt_orders &&
    !details
  ) {
    return null;
  }

  async function loadDetails() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/order-details`,
        { cache: "no-store" },
      );
      const result = (await response.json().catch(() => null)) as
        | TransactionOrderDetails
        | { message?: string }
        | null;
      if (
        !response.ok ||
        !result ||
        !("amazon_orders" in result) ||
        !("receipt_orders" in result)
      ) {
        throw new Error(
          result && "message" in result
            ? result.message
            : "Unable to load matched order details.",
        );
      }
      setDetails(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load matched order details.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!details) {
    return (
      <div className="mt-2">
        <button
          className="rounded-lg border border-accent/20 bg-accent/[0.04] px-3 py-2 text-xs font-medium text-accent disabled:opacity-50"
          disabled={loading}
          onClick={() => void loadDetails()}
          type="button"
        >
          {loading ? "Loading order details…" : "Show matched order details"}
        </button>
        {error ? <p className="mt-2 text-xs text-rose-100">{error}</p> : null}
      </div>
    );
  }

  return (
    <>
      <AmazonOrderDetails orders={details.amazon_orders} />
      <ReceiptOrderDetails orders={details.receipt_orders} />
    </>
  );
}
