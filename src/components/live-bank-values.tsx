"use client";

import { useEffect, useMemo, useState } from "react";

import { APP_BASE_PATH } from "@/lib/config";
import type { BankValueSnapshot } from "@/lib/snapshot-types";

type ConnectionState = "connecting" | "live" | "reconnecting" | "unavailable";

const accounts: Array<{
  key: keyof BankValueSnapshot;
  label: string;
  group: string;
}> = [
  { key: "chase_checking", label: "Chase Checking", group: "Cash" },
  { key: "chase_savings", label: "Chase Savings", group: "Cash" },
  { key: "chase_credit", label: "Chase Credit", group: "Credit" },
  { key: "citi_current", label: "Citi Current", group: "Credit" },
  { key: "citi_pending", label: "Citi Pending", group: "Pending" },
  { key: "barclays_card", label: "Barclays Card", group: "Credit" },
  { key: "etrade", label: "E*TRADE", group: "Investments" },
  {
    key: "betterment_general",
    label: "Betterment General",
    group: "Investments",
  },
  {
    key: "betterment_safety",
    label: "Betterment Safety",
    group: "Investments",
  },
  {
    key: "betterment_retirement",
    label: "Betterment Retirement",
    group: "Retirement",
  },
  {
    key: "fidelity_retirement",
    label: "Fidelity Retirement",
    group: "Retirement",
  },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value: string | number | undefined) {
  if (value === undefined) {
    return "—";
  }

  const number = Number(value);
  return Number.isFinite(number) ? currencyFormatter.format(number) : "—";
}

function formatUpdatedAt(value?: string) {
  if (!value) {
    return "Waiting for the first snapshot";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LiveBankValues({
  initialSnapshot,
}: {
  initialSnapshot: BankValueSnapshot | null;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let disposed = false;

    async function connect() {
      if (disposed) return;
      setConnectionState(reconnectAttempts ? "reconnecting" : "connecting");

      try {
        const ticketResponse = await fetch(
          `${APP_BASE_PATH}/api/snapshots/websocket-ticket`,
          { method: "POST" },
        );
        const ticketData = (await ticketResponse.json().catch(() => null)) as {
          url?: string;
        } | null;

        if (!ticketResponse.ok || !ticketData?.url) {
          throw new Error("Unable to authorize WebSocket.");
        }

        socket = new WebSocket(ticketData.url);

        socket.onopen = () => {
          reconnectAttempts = 0;
          setConnectionState("live");
        };

        socket.onmessage = (event) => {
          const message = JSON.parse(event.data) as {
            type?: string;
            snapshot?: BankValueSnapshot | null;
          };

          if (
            (message.type === "snapshot.initial" ||
              message.type === "snapshot.updated") &&
            message.snapshot
          ) {
            setSnapshot(message.snapshot);
          }
        };

        socket.onerror = () => {
          socket?.close();
        };

        socket.onclose = () => {
          if (disposed) return;
          reconnectAttempts += 1;
          setConnectionState("reconnecting");
          const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 30000);
          reconnectTimer = setTimeout(connect, delay);
        };
      } catch {
        if (disposed) return;
        reconnectAttempts += 1;
        setConnectionState(
          reconnectAttempts > 3 ? "unavailable" : "reconnecting",
        );
        const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 30000);
        reconnectTimer = setTimeout(connect, delay);
      }
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  const connectionLabel = useMemo(() => {
    if (connectionState === "live") return "Live updates";
    if (connectionState === "connecting") return "Connecting";
    if (connectionState === "reconnecting") return "Reconnecting";
    return "Live updates unavailable";
  }, [connectionState]);

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Snapshot updated {formatUpdatedAt(snapshot?.source_updated_at)}
        </p>
        <div
          className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
            connectionState === "live"
              ? "border-accent/20 bg-accent/10 text-accent"
              : "border-amber-200/20 bg-amber-200/10 text-amber-100"
          }`}
        >
          <span
            className={`size-2 rounded-full ${
              connectionState === "live"
                ? "bg-accent shadow-[0_0_12px_rgba(86,226,170,0.8)]"
                : "bg-amber-200"
            }`}
          />
          {connectionLabel}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => (
          <article className="surface rounded-2xl p-5" key={account.key}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-white/80">
                {account.label}
              </p>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                {account.group}
              </span>
            </div>
            <p className="mt-5 font-mono text-2xl font-semibold tracking-tight text-white">
              {formatCurrency(snapshot?.[account.key] as string | undefined)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
