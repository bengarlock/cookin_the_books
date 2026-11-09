"use client";

import {
  createContext,
  useCallback,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";

import { useRouter } from "next/navigation";

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
  refreshView: () => Promise<void>;
  registerDataRefresh: (refresh: () => Promise<void>) => () => void;
  viewRefreshError: string;
  isUpdatingView: boolean;
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
  const router = useRouter();
  const [isUpdatingView, setIsUpdatingView] = useState(false);
  const [viewRefreshError, setViewRefreshError] = useState("");
  const dataRefresh = useRef<(() => Promise<void>) | null>(null);
  const activeRefresh = useRef<Promise<void> | null>(null);
  const refreshQueued = useRef(false);
  const registerDataRefresh = useCallback((refresh: () => Promise<void>) => {
    dataRefresh.current = refresh;
    return () => { if (dataRefresh.current === refresh) dataRefresh.current = null; };
  }, []);
  const refreshView = useCallback(() => {
    refreshQueued.current = true;
    if (activeRefresh.current) return activeRefresh.current;
    setIsUpdatingView(true);
    setViewRefreshError("");
    const operation = (async () => {
      try {
        do {
          // Coalesce bursts and retain notifications received during a reload.
          await new Promise((resolve) => setTimeout(resolve, 300));
          refreshQueued.current = false;
          if (dataRefresh.current) await dataRefresh.current();
          else router.refresh();
        } while (refreshQueued.current);
      } catch (error) {
        setViewRefreshError("The latest page data could not be loaded. Please refresh again.");
        throw error;
      } finally {
        activeRefresh.current = null;
        setIsUpdatingView(false);
      }
    })();
    activeRefresh.current = operation;
    return operation;
  }, [router]);
  const [clientSnapshot, setClientSnapshot] = useState(initialSnapshot);
  const setSnapshot = useCallback((next: BankValueSnapshot | null) => {
    setClientSnapshot((current) => freshestSnapshot(current, next));
  }, []);
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

        if (disposed) return;
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
            // The Overview publishes its snapshot with the matching goal and
            // transaction data; other views can consume the live balance now.
            if (!dataRefresh.current) setSnapshot(message.snapshot);
            // Transactions can change even when the balance is identical.
            void refreshView().catch(() => undefined);
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
  }, [refreshView, setSnapshot]);

  useEffect(() => {
    // Keep dependent data current even if the live connection is unavailable.
    if (connectionState === "live") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshView().catch(() => undefined);
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [connectionState, refreshView]);

  return (
    <LiveSnapshotContext.Provider
      value={{ connectionState, snapshot, setSnapshot, refreshView, isUpdatingView, registerDataRefresh, viewRefreshError }}
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
