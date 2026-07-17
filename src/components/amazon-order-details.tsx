import type { AmazonOrder } from "@/lib/credit-card-transaction-types";

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

export function AmazonOrderDetails({ orders }: { orders: AmazonOrder[] }) {
  if (!orders.length) return null;

  const itemCount = orders.reduce(
    (total, order) => total + order.items.reduce((count, item) => count + item.quantity, 0),
    0,
  );
  const hasDifference = orders.some((order) => order.match_difference && Math.abs(Number(order.match_difference)) > 0.01);

  return (
    <details className="mt-2 rounded-lg border border-orange-200/15 bg-orange-100/[0.04] text-xs">
      <summary className="cursor-pointer list-none px-3 py-2 text-orange-100/85 marker:hidden">
        <span className="font-medium">Amazon</span>
        <span className="ml-2 text-white/45">
          {itemCount} {itemCount === 1 ? "item" : "items"} · {orders.length} {orders.length === 1 ? "order" : "orders"}
        </span>
        {hasDifference ? <span className="ml-2 text-amber-200">· payment difference</span> : null}
      </summary>
      <div className="space-y-3 border-t border-orange-200/10 px-3 py-3">
        {orders.map((order) => (
          <div key={order.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px]">
              <span className="font-medium text-white/85">Order {order.order_id}</span>
              <span className="font-mono text-white/70">{formatCurrency(order.total_amount)}</span>
            </div>
            <p className="mt-1 text-[10px] text-white/45">
              {formatDate(order.order_date)} · {order.status || "Amazon order"}
              {order.match_difference && Math.abs(Number(order.match_difference)) > 0.01
                ? ` · card ${formatCurrency(order.match_difference)} vs order`
                : ""}
            </p>
            <div className="mt-2 space-y-1.5">
              {order.items.map((item) => (
                <div className="flex gap-2 text-[11px] text-white/70" key={item.id}>
                  <span className="shrink-0 font-mono text-white/45">{item.quantity}×</span>
                  <span className="min-w-0 flex-1">{item.product.name}</span>
                  <span className="shrink-0 font-mono text-white/55">{formatCurrency(item.total_amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
