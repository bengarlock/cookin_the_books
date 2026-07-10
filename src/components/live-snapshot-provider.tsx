"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { APP_BASE_PATH } from "@/lib/config";
import type { BankValueSnapshot } from "@/lib/snapshot-types";

export type ConnectionState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "unavailable";

type LiveSnapshotContextValue = {
  connectionState: ConnectionState;
  snapshot: BankValueSnapshot | null;
  setSnapshot: (snapshot: BankValueSnapshot | null) => void;
};

const LiveSnapshotContext =
  createContext<LiveSnapshotContextValue | null>(null);

function snapshotTimestamp(snapshot: BankValueSnapshot | null) {
  if (!snapshot) return 0;
  const updatedAt = Date.parse(snapshot.updated_at || "");
  if (Number.isFinite(updatedAt)) return updatedAt;
  const sourceUpdatedAt = Date.parse(snapshot.source_updated_at || "");
  return Number.isFinite(sourceUpdatedAt) ? sourceUpdatedAt : 0;
}

function freshestSnapshot(
  current: BankValueSnapshot | null,
  next: BankValueSnapshot | null,
) {
  if (!next) return current;
  if (!current) return next;
  const currentTimestamp = snapshotTimestamp(current);
  const nextTimestamp = snapshotTimestamp(next);
  if (nextTimestamp > currentTimestamp) return next;
  if (nextTimestamp === currentTimestamp && next.id >= current.id) return next;
  return current;
}

export function LiveSnapshotProvider({
  children,
  initialSnapshot,
}: {
  children: ReactNode;
  initialSnapshot: BankValueSnapshot | null;
}) {
  const [clientSnapshot, setClientSnapshot] = useState(initialSnapshot);
  const snapshot = freshestSnapshot(clientSnapshot, initialSnapshot);
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
            setClientSnapshot(message.snapshot);
          }
        };
        socket.onerror = () => socket?.close();
        socket.onclose = () => {
          if (disposed) return;
          reconnectAttempts += 1;
          setConnectionState("reconnecting");
          reconnectTimer = setTimeout(
            connect,
            Math.min(1000 * 2 ** (reconnectAttempts - 1), 30000),
          );
        };
      } catch {
        if (disposed) return;
        reconnectAttempts += 1;
        setConnectionState(
          reconnectAttempts > 3 ? "unavailable" : "reconnecting",
        );
        reconnectTimer = setTimeout(
          connect,
          Math.min(1000 * 2 ** (reconnectAttempts - 1), 30000),
        );
      }
    }

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return (
    <LiveSnapshotContext.Provider
      value={{ connectionState, snapshot, setSnapshot: setClientSnapshot }}
    >
      {children}
    </LiveSnapshotContext.Provider>
  );
}

export function useLiveSnapshot() {
  const value = useContext(LiveSnapshotContext);
  if (!value) {
    throw new Error("useLiveSnapshot must be used within LiveSnapshotProvider.");
  }
  return value;
}
