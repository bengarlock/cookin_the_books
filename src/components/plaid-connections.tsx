"use client";

import { useEffect, useState } from "react";
import {
  usePlaidLink,
  type PlaidLinkOnExit,
  type PlaidLinkOnSuccess,
} from "react-plaid-link";

import { APP_BASE_PATH } from "@/lib/config";
import type { PlaidConnection, PlaidSyncResult } from "@/lib/plaid-types";

function messageFrom(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    if ("message" in data && typeof data.message === "string") return data.message;
    if ("detail" in data && typeof data.detail === "string") return data.detail;
  }
  return fallback;
}

function PlaidLauncher({
  token,
  onConnected,
  onFinished,
}: {
  token: string;
  onConnected: (result: PlaidSyncResult) => void;
  onFinished: (error?: string) => void;
}) {
  const onSuccess: PlaidLinkOnSuccess = async (publicToken, metadata) => {
    try {
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
  const [connections, setConnections] = useState(initialConnections);
  const [linkToken, setLinkToken] = useState("");
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
    setLinkToken(data.link_token);
  }

  async function syncConnection(id: number) {
    setBusyId(id);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${APP_BASE_PATH}/api/plaid/connections/${id}/sync`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as PlaidSyncResult | null;
      if (!response.ok || !data?.connection) throw new Error(messageFrom(data, "Sync failed."));
      setConnections((current) => current.map((item) => item.id === id ? data.connection : item));
      setStatus(`${data.sync.created_count} added, ${data.sync.updated_count} updated, ${data.sync.removed_count} removed.`);
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
      {linkToken ? (
        <PlaidLauncher
          token={linkToken}
          onConnected={(result) => {
            setConnections((current) => [result.connection, ...current.filter((item) => item.id !== result.connection.id)]);
            setStatus(`${result.connection.institution_name || "Institution"} connected; ${result.sync.created_count} transactions imported.`);
          }}
          onFinished={(nextError) => {
            setLinkToken("");
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
        <button className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#07100f] disabled:opacity-60" disabled={Boolean(linkToken)} onClick={connectInstitution} type="button">
          {linkToken ? "Opening Plaid…" : "Connect institution"}
        </button>
      </div>
      {error ? <p className="border-b border-rose-300/15 bg-rose-300/10 px-5 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      {status ? <p className="border-b border-accent/15 bg-accent/10 px-5 py-3 text-sm text-accent" role="status">{status}</p> : null}
      {connections.length ? connections.map((connection) => (
        <div className="border-b border-white/10 p-5 last:border-b-0" key={connection.id}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
            <div className="flex flex-wrap gap-2">
              <button className="rounded-lg border border-accent/25 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50" disabled={busyId === connection.id} onClick={() => syncConnection(connection.id)} type="button">{busyId === connection.id ? "Working…" : "Sync"}</button>
              {confirmingDeleteId === connection.id ? (
                <><button className="rounded-lg bg-rose-300 px-3 py-2 text-xs font-semibold text-[#22090f] disabled:opacity-50" disabled={busyId === connection.id} onClick={() => disconnect(connection.id)} type="button">Confirm disconnect</button><button className="rounded-lg border border-white/10 px-3 py-2 text-xs text-muted" onClick={() => setConfirmingDeleteId(null)} type="button">Cancel</button></>
              ) : <button className="rounded-lg border border-white/10 px-3 py-2 text-xs text-muted" onClick={() => setConfirmingDeleteId(connection.id)} type="button">Disconnect</button>}
            </div>
          </div>
        </div>
      )) : <p className="p-5 text-sm text-muted">No institutions connected yet.</p>}
    </section>
  );
}
