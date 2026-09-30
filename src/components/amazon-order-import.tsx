"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  amazonImportErrorMessage,
  validateAmazonOrderImportFile,
} from "@/lib/amazon-order-import";
import { APP_BASE_PATH } from "@/lib/config";

type ImportStatus = {
  status?: "queued" | "running" | "completed" | "failed";
  total_orders?: number;
  result?: {
    orders?: number;
    items?: number;
    matched_orders?: number;
  };
  error?: string;
  message?: string;
};

export function AmazonOrderImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importId, setImportId] = useState<number | null>(null);

  useEffect(() => {
    if (importId === null) return;
    let cancelled = false;

    async function readStatus() {
      const response = await fetch(
        `${APP_BASE_PATH}/api/amazon-orders/imports/${importId}`,
        { cache: "no-store" },
      );
      const result = await response.json().catch(() => null) as
        | ImportStatus
        | null;
      if (cancelled) return;
      if (!response.ok) {
        setError(
          amazonImportErrorMessage(
            result,
            "The Amazon import status could not be loaded.",
          ),
        );
        setImportId(null);
        setIsImporting(false);
        return;
      }
      if (result?.status === "completed") {
        const summary = result.result || {};
        setMessage(
          (
            `${summary.orders || 0} orders and ` +
            `${summary.items || 0} items imported; ` +
            `${summary.matched_orders || 0} linked to card transactions.`
          ),
        );
        setImportId(null);
        setIsImporting(false);
        router.refresh();
      } else if (result?.status === "failed") {
        setError(
          result.error ||
            "The Amazon order import could not be completed.",
        );
        setImportId(null);
        setIsImporting(false);
      } else if (result?.status === "queued") {
        setMessage("Amazon order history is queued for import...");
      } else if (result?.status === "running") {
        setMessage(
          result.total_orders
            ? `Importing ${result.total_orders.toLocaleString()} Amazon orders...`
            : "Amazon order history is importing in the background...",
        );
      }
    }

    void readStatus().catch(() => {
      if (!cancelled) {
        setMessage("Amazon order history is still importing...");
      }
    });
    const interval = window.setInterval(
      () => void readStatus().catch(() => {
        if (!cancelled) {
          setMessage("Amazon order history is still importing...");
        }
      }),
      2_000,
    );
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [importId, router]);

  async function importFile(file: File) {
    const validationError = validateAmazonOrderImportFile(file);
    if (validationError) {
      setError(validationError);
      setMessage("");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setIsImporting(true);
    setMessage("");
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(
        `${APP_BASE_PATH}/api/amazon-orders/import`,
        {
          method: "POST",
          body: formData,
        },
      );
      const result = await response.json().catch(() => null) as
        | { import_id?: number; message?: string; detail?: string; file?: string }
        | null;
      if (!response.ok) {
        throw new Error(
          amazonImportErrorMessage(result, "Amazon order import failed."),
        );
      }
      if (!result?.import_id) {
        throw new Error(
          "The Amazon import was queued without an import ID.",
        );
      }
      setMessage("Amazon order history uploaded. Importing in the background...");
      setImportId(result.import_id);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Amazon order import failed.",
      );
      setIsImporting(false);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Amazon data
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Order history
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Upload Amazon&apos;s Your Orders ZIP export. We&apos;ll find Order
            History.csv inside it and link individual products to matching
            pending or posted card transactions.
          </p>
          <a
            className="mt-3 inline-block text-sm font-medium text-accent underline decoration-accent/30 underline-offset-4 transition hover:text-accent/80"
            href="https://www.amazon.com/hz/privacy-central/data-requests/preview.html#:~:text=Submit%20Request-,Request%20All%20Your%20Data,-By%20requesting%20%22all"
            rel="noopener noreferrer"
            target="_blank"
          >
            Request your Amazon data
          </a>
        </div>
        <label className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#07100f] transition hover:bg-accent disabled:opacity-60">
          {isImporting ? "Importing..." : "Choose ZIP"}
          <input
            ref={inputRef}
            accept=".zip,application/zip,.csv,text/csv"
            className="sr-only"
            disabled={isImporting}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
            type="file"
          />
        </label>
      </div>
      {message ? (
        <p
          className="border-b border-accent/15 bg-accent/10 px-5 py-3 text-sm text-accent"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          className="border-b border-rose-300/15 bg-rose-300/10 px-5 py-3 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="p-5 sm:p-6">
        <p className="text-xs text-muted">
          ZIP exports up to 100 MB are supported. You can also upload the
          legacy Order History.csv file directly.
        </p>
      </div>
    </section>
  );
}
