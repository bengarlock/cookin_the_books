"use client";

import { useEffect, useState } from "react";

import { AmazonOrderDetails } from "@/components/amazon-order-details";
import { ReceiptOrderDetails } from "@/components/receipt-order-details";
import { APP_BASE_PATH } from "@/lib/config";
import type {
  ExpenseTransaction,
  TransactionOrderDetails,
} from "@/lib/credit-card-transaction-types";

export function MatchedOrderDetails({
  transaction,
  onLineItemsAvailable,
}: {
  transaction: ExpenseTransaction;
  onLineItemsAvailable?: (available: boolean) => void;
}) {
  const [details, setDetails] = useState<TransactionOrderDetails | null>(
    transaction.amazon_orders || transaction.receipt_orders
      ? {
          amazon_orders: transaction.amazon_orders || [],
          receipt_orders: transaction.receipt_orders || [],
        }
      : null,
  );
  const [loading, setLoading] = useState(
    !details &&
      (transaction.has_amazon_orders || transaction.has_receipt_orders),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    onLineItemsAvailable?.(Boolean(
      details?.amazon_orders.some((order) => order.items.length) ||
      details?.receipt_orders.some((order) => order.items.length),
    ));
  }, [details, onLineItemsAvailable]);

  useEffect(() => {
    if (
      details ||
      (!transaction.has_amazon_orders && !transaction.has_receipt_orders)
    ) {
      return;
    }

    const controller = new AbortController();

    async function loadDetails() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `${APP_BASE_PATH}/api/credit-card-transactions/${transaction.id}/order-details`,
          { cache: "no-store", signal: controller.signal },
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
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load matched order details.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDetails();
    return () => controller.abort();
  }, [
    details,
    transaction.has_amazon_orders,
    transaction.has_receipt_orders,
    transaction.id,
  ]);

  if (
    !transaction.has_amazon_orders &&
    !transaction.has_receipt_orders &&
    !details
  ) {
    return null;
  }

  if (!details) {
    return (
      <div className="mt-2">
        {loading ? (
          <p className="text-xs text-muted" role="status">
            Loading matched order details…
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-rose-100" role="alert">
            {error}
          </p>
        ) : null}
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
