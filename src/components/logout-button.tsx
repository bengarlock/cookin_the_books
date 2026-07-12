"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { APP_BASE_PATH } from "@/lib/config";

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path
        d="M10 6H6.75A1.75 1.75 0 0 0 5 7.75v8.5C5 17.22 5.78 18 6.75 18H10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <path
        d="M14.5 8.5 18 12l-3.5 3.5M18 12H9.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function logout() {
    setIsSubmitting(true);

    try {
      await fetch(`${APP_BASE_PATH}/api/auth/logout`, {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      className="dashboard-logout flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
      type="button"
      onClick={logout}
      disabled={isSubmitting}
      aria-label={isSubmitting ? "Signing out" : "Sign out"}
      title={isSubmitting ? "Signing out…" : "Sign out"}
    >
      <LogoutIcon />
      <span className="sr-only">{isSubmitting ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
