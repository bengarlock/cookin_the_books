"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { APP_BASE_PATH } from "@/lib/config";
import { AUTH_INVALIDATED_HEADER } from "@/lib/auth-invalidation";
import { DEMO_ENTRY_PATH } from "@/lib/demo";

export function AuthInvalidationBoundary({ isDemo = false }: { isDemo?: boolean }) {
  const router = useRouter();

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
        if (isDemo) {
          // The demo link is a route handler, not a page, so leave the client
          // router and let it issue a fresh demo session.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign(`${APP_BASE_PATH}${DEMO_ENTRY_PATH}`);
          return response;
        }
        await originalFetch(`${APP_BASE_PATH}/api/auth/logout`, {
          method: "POST",
        }).catch(() => undefined);
        // Matches LogoutButton: refresh drops the cached dashboard data.
        router.replace("/login?session=expired");
        router.refresh();
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isDemo, router]);

  return null;
}
