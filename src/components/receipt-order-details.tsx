"use client";

import type { ReceiptOrder } from "@/lib/credit-card-transaction-types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value: string | null | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) ? currencyFormatter.format(amount) : "—";
}

function formatDate(value: string | null) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(0, 10)
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function ReceiptOrderDetails({ orders }: { orders: ReceiptOrder[] }) {
  const visibleOrders = orders.filter((order) => order.vendor_key !== "amazon");
  if (!visibleOrders.length) return null;

  const itemCount = visibleOrders.reduce(
    (total, order) => total + order.items.reduce((count, item) => count + item.quantity, 0),
    0,
  );

  return (
    <details className="mt-2 rounded-lg border border-accent/20 bg-accent/[0.04] text-xs">
      <summary className="cursor-pointer list-none px-3 py-2 text-accent marker:hidden">
        <span className="font-medium">{visibleOrders[0].merchant_name || visibleOrders[0].vendor_key}</span>
        <span className="ml-2 text-muted">
          {itemCount} {itemCount === 1 ? "item" : "items"} · {visibleOrders.length} {visibleOrders.length === 1 ? "order" : "orders"}
        </span>
      </summary>
      <div className="space-y-3 border-t border-accent/15 px-3 py-3">
        {visibleOrders.map((order) => (
          <div key={order.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px]">
              <span className="font-medium text-foreground">Order {order.external_order_id}</span>
              <span className="font-mono text-foreground">{formatCurrency(order.total_amount)}</span>
            </div>
            <p className="mt-1 text-[10px] text-muted">
              {formatDate(order.order_date)} · {order.match_method === "exact" ? "Matched" : "Parsed"}
            </p>
            {order.items.length ? (
              <div className="mt-2 space-y-1.5">
                {order.items.map((item) => (
                  <div className="flex gap-2 rounded-lg border border-line/70 bg-panel-soft/45 p-2.5 text-[11px] text-foreground/80" key={item.id}>
                    <span className="shrink-0 font-mono text-muted">{item.quantity}×</span>
                    <span className="min-w-0 flex-1">{item.name}</span>
                    <span className="shrink-0 font-mono text-muted">{formatCurrency(item.total_amount)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="mt-2 text-[11px] text-muted">No line items were extracted from this receipt.</p>}
          </div>
        ))}
      </div>
    </details>
  );
}
