import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME || "cookinTheBooksToken";

export const AUTH_COOKIE_MAX_AGE = Number(
  process.env.AUTH_COOKIE_MAX_AGE_SECONDS || 60 * 60 * 24,
);

type VerificationResult = {
  authenticated: boolean;
};

export const verifyPortfolioSession = cache(
  async (): Promise<VerificationResult> => {
    const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return { authenticated: false };
    }

    try {
      const response = await fetch(
        `${getPortfolioApiBaseUrl()}/api/v1/login/verify-token/`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Token ${token}`,
          },
          cache: "no-store",
        },
      );

      if (!response.ok) {
        return { authenticated: false };
      }

      const data = (await response.json().catch(() => null)) as {
        valid?: boolean;
      } | null;

      return { authenticated: data?.valid === true };
    } catch {
      return { authenticated: false };
    }
  },
);
