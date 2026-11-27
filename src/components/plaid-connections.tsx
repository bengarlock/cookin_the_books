"use client";

import { useEffect, useState } from "react";
import {
  usePlaidLink,
  type PlaidLinkOnExit,
  type PlaidLinkOnSuccess,
} from "react-plaid-link";

import { DEMO_DISABLED_MESSAGE, useIsDemo } from "@/components/demo-mode";
import { APP_BASE_PATH } from "@/lib/config";
import type { PlaidConnection, PlaidSyncResult } from "@/lib/plaid-types";

const actionButtonClass =
  "h-9 min-w-20 rounded-lg border px-3 text-xs font-semibold transition disabled:opacity-50";
const primaryActionClass = `${actionButtonClass} border-accent/25 text-accent hover:border-accent/40 hover:bg-accent/10`;
const investmentActionClass = `${actionButtonClass} min-w-24 border-gold/35 text-gold hover:border-gold/50 hover:bg-gold/10`;
const quietActionClass =
  "h-9 min-w-20 rounded-lg border border-white/10 px-3 text-xs font-semibold text-muted transition hover:border-white/20 hover:text-white disabled:opacity-50";
const dangerActionClass =
  "h-9 min-w-20 rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/15 disabled:opacity-50";

function messageFrom(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    if ("message" in data && typeof data.message === "string") return data.message;
    if ("detail" in data && typeof data.detail === "string") return data.detail;
  }
  return fallback;
}

function PlaidLauncher({
  connectionId,
  token,
  onConnected,
  onUpdated,
  onFinished,
}: {
  connectionId?: number;
  token: string;
  onConnected: (result: PlaidSyncResult) => void;
  onUpdated: (connectionId: number) => Promise<void>;
  onFinished: (error?: string) => void;
}) {
  const onSuccess: PlaidLinkOnSuccess = async (publicToken, metadata) => {
    try {
      if (connectionId) {
        await onUpdated(connectionId);
        onFinished();
        return;
      }
      const response = await fetch(`${APP_BASE_PATH}/api/plaid/exchange-public-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken, institution: metadata.institution }),
      });
      const data = (await response.json().catch(() => null)) as PlaidSyncResult | null;
      if (!response.ok || !data?.connection) {
        throw new Error(messageFrom(data, "The bank connection could not be saved."));
      }
      onConnected(data);
      onFinished();
    } catch (error) {
      onFinished(error instanceof Error ? error.message : "The bank connection could not be saved.");
    }
  };
  const onExit: PlaidLinkOnExit = (error) => onFinished(error?.display_message || undefined);
  const { open, ready } = usePlaidLink({ token, onSuccess, onExit });

  useEffect(() => {
    if (ready) open();
  }, [open, ready]);

  return null;
}

export function PlaidConnections({ initialConnections }: { initialConnections: PlaidConnection[] }) {
  const isDemo = useIsDemo();
  const [connections, setConnections] = useState(initialConnections);
  const [linkRequest, setLinkRequest] = useState<{ token: string; connectionId?: number; purpose?: "reauthorize" | "investments" } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function connectInstitution() {
    setError("");
    setStatus("");
    const response = await fetch(`${APP_BASE_PATH}/api/plaid/link-token`, { method: "POST" });
    const data = (await response.json().catch(() => null)) as { link_token?: string } | null;
    if (!response.ok || !data?.link_token) {
      setError(messageFrom(data, "Plaid Link could not be started."));
      return;
    }
    setLinkRequest({ token: data.link_token });
  }

  async function updateConnection(connectionId: number, purpose: "reauthorize" | "investments") {
    setBusyId(connectionId);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/plaid/link-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_id: connectionId, purpose }),
      });
      const data = (await response.json().catch(() => null)) as { link_token?: string } | null;
      if (!response.ok || !data?.link_token) {
        throw new Error(messageFrom(data, "Plaid Link could not be started."));
      }
      setLinkRequest({ token: data.link_token, connectionId, purpose });
    } catch (linkError) {
      setBusyId(null);
      setError(linkError instanceof Error ? linkError.message : "Plaid Link could not be started.");
    }
  }

  async function syncConnection(id: number, statusMessage?: string) {
    setBusyId(id);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/plaid/connections/${id}/sync`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as PlaidSyncResult | null;
      if (!response.ok || !data?.connection) throw new Error(messageFrom(data, "Sync failed."));
      setConnections((current) => current.map((item) => item.id === id ? data.connection : item));
      setStatus(statusMessage || `${data.sync.created_count} added, ${data.sync.updated_count} updated, ${data.sync.removed_count} removed.`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sync failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect(id: number) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/plaid/connections/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(messageFrom(data, "Disconnect failed."));
      }
      setConnections((current) => current.filter((item) => item.id !== id));
      setConfirmingDeleteId(null);
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Disconnect failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="surface overflow-hidden rounded-2xl">
      {linkRequest ? (
        <PlaidLauncher
          connectionId={linkRequest.connectionId}
          token={linkRequest.token}
          onConnected={(result) => {
            setConnections((current) => [result.connection, ...current.filter((item) => item.id !== result.connection.id)]);
            setStatus(`${result.connection.institution_name || "Institution"} connected; ${result.sync.created_count} transactions imported.`);
          }}
          onUpdated={async (connectionId) => {
            await syncConnection(
              connectionId,
              linkRequest.purpose === "investments"
                ? "Investment access enabled and account data refreshed."
                : "Authorization updated and account data refreshed.",
            );
          }}
          onFinished={(nextError) => {
            setLinkRequest(null);
            setBusyId(null);
            if (nextError) setError(nextError);
          }}
        />
      ) : null}
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Automatic transaction sync</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Connected institutions</h2>
          <p className="mt-1 text-sm text-muted">Plaid imports recent card activity, including pending transactions.</p>
        </div>
        <button
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#07100f] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isDemo || Boolean(linkRequest)}
          onClick={connectInstitution}
          title={isDemo ? DEMO_DISABLED_MESSAGE : undefined}
          type="button"
        >
          {linkRequest ? "Opening Plaid…" : "Connect institution"}
        </button>
      </div>
      {isDemo ? <p className="border-b border-accent/15 bg-accent/10 px-5 py-3 text-sm text-accent" role="note">{DEMO_DISABLED_MESSAGE} The demo&apos;s transactions are sample data.</p> : null}
      {error ? <p className="border-b border-rose-300/15 bg-rose-300/10 px-5 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      {status ? <p className="border-b border-accent/15 bg-accent/10 px-5 py-3 text-sm text-accent" role="status">{status}</p> : null}
      {connections.length ? connections.map((connection) => (
        <div className="border-b border-white/10 p-5 last:border-b-0" key={connection.id}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{connection.institution_name || "Connected institution"}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${connection.status === "connected" ? "bg-accent/10 text-accent" : "bg-rose-300/10 text-rose-200"}`}>{connection.status}</span>
              </div>
              <p className="mt-2 text-xs text-muted">{connection.last_synced_at ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}` : "Waiting for initial transaction sync"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {connection.accounts.map((account) => <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/75" key={account.id}>{account.name}{account.mask ? ` •••• ${account.mask}` : ""}</span>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-start lg:max-w-[30rem] lg:justify-end">
              <button
                className={primaryActionClass}
                disabled={busyId === connection.id || Boolean(linkRequest)}
                onClick={() => void updateConnection(connection.id, "reauthorize")}
                type="button"
              >
                {busyId === connection.id ? "Working..." : "Reauth"}
              </button>
              {connection.accounts.some((account) => account.account_type === "investment") ? (
                <button
                  className={investmentActionClass}
                  disabled={busyId === connection.id || Boolean(linkRequest)}
                  onClick={() => void updateConnection(connection.id, "investments")}
                  type="button"
                >
                  {busyId === connection.id ? "Working..." : "Investments"}
                </button>
              ) : null}
              <button className={primaryActionClass} disabled={busyId === connection.id} onClick={() => syncConnection(connection.id)} type="button">{busyId === connection.id ? "Working..." : "Sync"}</button>
              {confirmingDeleteId === connection.id ? (
                <>
                  <button className={dangerActionClass} disabled={busyId === connection.id} onClick={() => disconnect(connection.id)} type="button">Confirm</button>
                  <button className={quietActionClass} onClick={() => setConfirmingDeleteId(null)} type="button">Cancel</button>
                </>
              ) : <button className={quietActionClass} onClick={() => setConfirmingDeleteId(connection.id)} type="button">Remove</button>}
            </div>
          </div>
        </div>
      )) : <p className="p-5 text-sm text-muted">No institutions connected yet.</p>}
    </section>
  );
}
