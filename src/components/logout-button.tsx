"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { APP_BASE_PATH } from "@/lib/config";

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
      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
      type="button"
      onClick={logout}
      disabled={isSubmitting}
    >
      {isSubmitting ? "Signing out…" : "Sign out"}
    </button>
  );
}
