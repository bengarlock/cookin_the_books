"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { APP_BASE_PATH } from "@/lib/config";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitPhase, setSubmitPhase] = useState<"idle" | "signing-in" | "loading-profile">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitPhase("signing-in");

    try {
      const response = await fetch(`${APP_BASE_PATH}/api/auth/login`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        setError(data?.message || "Unable to sign in.");
        return;
      }

      setSubmitPhase("loading-profile");
      const nextPath = searchParams.get("next");
      const destination =
        nextPath?.startsWith("/dashboard") ? nextPath : "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Unable to reach the application server.");
    } finally {
      setSubmitPhase((current) => current === "loading-profile" ? current : "idle");
    }
  }

  const isSubmitting = submitPhase !== "idle";

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-emerald-50/75">
          Username
        </span>
        <input
          className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition placeholder:text-white/25 focus:border-accent/60 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/40 disabled:opacity-70"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          disabled={isSubmitting}
          required
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-emerald-50/75">
          Password
        </span>
        <input
          className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition placeholder:text-white/25 focus:border-accent/60 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/40 disabled:opacity-70"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          disabled={isSubmitting}
          required
        />
      </label>

      {error ? (
        <p
          className="rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-strong px-5 font-semibold text-[#03120c] transition hover:bg-accent disabled:cursor-wait disabled:opacity-60"
        type="submit"
        disabled={isSubmitting}
      >
        {submitPhase !== "idle" ? (
          <>
            <span
              className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
              aria-hidden="true"
            />
            <span>{submitPhase === "loading-profile" ? "Loading profile..." : "Logging in..."}</span>
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
