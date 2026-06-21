import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="app-backdrop flex min-h-screen items-center justify-center px-5 py-12">
      <section className="surface w-full max-w-md rounded-3xl p-7 sm:p-9">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl border border-accent/25 bg-accent/10 text-lg font-bold text-accent">
            C
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Cookin&apos; the Books
            </p>
            <p className="text-xs text-muted">Financial operations console</p>
          </div>
        </div>

        <div className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
            Secure access
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Welcome back
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Sign in with your portfolio account. Credentials are exchanged
            directly with the backend and are never stored by this app.
          </p>
        </div>

        <Suspense fallback={<p className="mt-8 text-sm text-muted">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
