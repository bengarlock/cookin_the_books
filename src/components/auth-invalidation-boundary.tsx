"use client";

import { useEffect } from "react";

import { APP_BASE_PATH } from "@/lib/config";
import { AUTH_INVALIDATED_HEADER } from "@/lib/auth-invalidation";

export function AuthInvalidationBoundary() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let redirecting = false;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (
        response.status === 401 &&
        response.headers.get(AUTH_INVALIDATED_HEADER) === "1" &&
        !redirecting
      ) {
        redirecting = true;
        await originalFetch(`${APP_BASE_PATH}/api/auth/logout`, {
          method: "POST",
        }).catch(() => undefined);
        window.location.assign(`${APP_BASE_PATH}/login?session=expired`);
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
