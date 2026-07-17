"use client";

import { useState } from "react";

import type { AmazonOrder, AmazonOrderItem, ExpenseTag } from "@/lib/credit-card-transaction-types";
import { APP_BASE_PATH } from "@/lib/config";

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

export function AmazonOrderDetails({
  orders,
  tagLibrary = [],
}: {
  orders: AmazonOrder[];
  tagLibrary?: ExpenseTag[];
}) {
  if (!orders.length) return null;

  return <AmazonOrderDetailsContent orders={orders} tagLibrary={tagLibrary} />;
}

function AmazonOrderDetailsContent({
  orders: initialOrders,
  tagLibrary,
}: {
  orders: AmazonOrder[];
  tagLibrary: ExpenseTag[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [tagError, setTagError] = useState("");
  const [newTagByItem, setNewTagByItem] = useState<Record<number, string>>({});

  async function saveItemTags(item: AmazonOrderItem, names: string[]) {
    setSavingItemId(item.id);
    setTagError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/amazon-order-items/${item.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: names }),
      });
      const updated = await response.json().catch(() => null) as AmazonOrderItem | { message?: string } | null;
      if (!response.ok || !updated || !("id" in updated)) {
        throw new Error(updated && "message" in updated ? updated.message : "The item tags could not be updated.");
      }
      setOrders((current) => current.map((order) => ({
        ...order,
        items: order.items.map((currentItem) => currentItem.id === updated.id ? updated : currentItem),
      })));
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "The item tags could not be updated.");
    } finally {
      setSavingItemId(null);
    }
  }

  function toggleItemTag(item: AmazonOrderItem, name: string) {
    const names = item.tags.map((tag) => tag.name);
    const nextNames = names.some((tag) => tag.toLowerCase() === name.toLowerCase())
      ? names.filter((tag) => tag.toLowerCase() !== name.toLowerCase())
      : [...names, name];
    void saveItemTags(item, nextNames);
  }

  function addNewItemTag(item: AmazonOrderItem) {
    const name = (newTagByItem[item.id] || "").trim();
    if (!name) return;
    const names = item.tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())
      ? item.tags.map((tag) => tag.name)
      : [...item.tags.map((tag) => tag.name), name];
    setNewTagByItem((current) => ({ ...current, [item.id]: "" }));
    void saveItemTags(item, names);
  }

  const itemCount = orders.reduce(
    (total, order) => total + order.items.reduce((count, item) => count + item.quantity, 0),
    0,
  );
  const hasDifference = orders.some((order) => order.match_difference && Math.abs(Number(order.match_difference)) > 0.01);

  return (
    <details className="mt-2 rounded-lg border border-accent/20 bg-accent/[0.04] text-xs">
      <summary className="cursor-pointer list-none px-3 py-2 text-accent marker:hidden">
        <span className="font-medium">Amazon</span>
        <span className="ml-2 text-muted">
          {itemCount} {itemCount === 1 ? "item" : "items"} · {orders.length} {orders.length === 1 ? "order" : "orders"}
        </span>
        {hasDifference ? <span className="ml-2 text-gold">· payment difference</span> : null}
      </summary>
      <div className="space-y-3 border-t border-accent/15 px-3 py-3">
        {orders.map((order) => (
          <div key={order.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px]">
              <span className="font-medium text-foreground">Order {order.order_id}</span>
              <span className="font-mono text-foreground">{formatCurrency(order.total_amount)}</span>
            </div>
            <p className="mt-1 text-[10px] text-muted">
              {formatDate(order.order_date)} · {order.status || "Amazon order"}
              {order.match_difference && Math.abs(Number(order.match_difference)) > 0.01
                ? ` · card ${formatCurrency(order.match_difference)} vs order`
                : ""}
            </p>
            <div className="mt-2 space-y-1.5">
              {order.items.map((item) => {
                const availableTags = tagLibrary.filter(
                  (tag) => !item.tags.some((selected) => selected.id === tag.id),
                );
                return (
                  <div className="rounded-lg border border-line/70 bg-panel-soft/45 p-2.5" key={item.id}>
                    <div className="flex gap-2 text-[11px] text-foreground/80">
                      <span className="shrink-0 font-mono text-muted">{item.quantity}×</span>
                      <span className="min-w-0 flex-1">{item.product.name}</span>
                      <span className="shrink-0 font-mono text-muted">{formatCurrency(item.total_amount)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {item.tags.map((tag) => (
                        <button
                          aria-label={`Remove ${tag.name} tag from ${item.product.name}`}
                          className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50"
                          disabled={savingItemId === item.id}
                          key={tag.id}
                          onClick={() => toggleItemTag(item, tag.name)}
                          title={`Remove ${tag.name}`}
                          type="button"
                        >
                          {tag.name} ×
                        </button>
                      ))}
                      {availableTags.map((tag) => (
                        <button
                          className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted transition hover:border-accent/30 hover:text-accent disabled:opacity-50"
                          disabled={savingItemId === item.id}
                          key={tag.id}
                          onClick={() => toggleItemTag(item, tag.name)}
                          type="button"
                        >
                          + {tag.name}
                        </button>
                      ))}
                      <input
                        aria-label={`Create tag for ${item.product.name}`}
                        className="h-6 min-w-28 flex-1 rounded-md border border-line bg-panel px-2 text-[10px] text-foreground outline-none placeholder:text-muted focus:border-accent/50"
                        onChange={(event) => setNewTagByItem((current) => ({ ...current, [item.id]: event.target.value }))}
                        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addNewItemTag(item); } }}
                        placeholder="New tag"
                        value={newTagByItem[item.id] || ""}
                      />
                      <button
                        className="rounded-md border border-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent disabled:opacity-50"
                        disabled={savingItemId === item.id || !(newTagByItem[item.id] || "").trim()}
                        onClick={() => addNewItemTag(item)}
                        type="button"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {tagError ? <p className="text-xs text-rose-200" role="alert">{tagError}</p> : null}
      </div>
    </details>
  );
}
