import "server-only";

import type { NextResponse } from "next/server";

import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  LEGACY_AUTH_COOKIE_NAMES,
} from "@/lib/auth";
import { getAuthCookieScope } from "@/lib/auth-cookie-options";
import { DEMO_COOKIE_NAME } from "@/lib/demo";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export type PortfolioLoginResult =
  | { ok: true; token: string }
  | { ok: false; status: number; message: string };

/** Exchange credentials for a portfolio_database token. Throws on network or config errors. */
export async function requestPortfolioToken(
  username: string,
  password: string,
): Promise<PortfolioLoginResult> {
  const backendResponse = await fetch(`${getPortfolioApiBaseUrl()}/api/v1/login/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  const data = (await backendResponse.json().catch(() => null)) as {
    token?: string;
    message?: string;
  } | null;

  if (!backendResponse.ok || !data?.token) {
    return {
      ok: false,
      status: backendResponse.status || 401,
      message: data?.message || "Invalid username or password.",
    };
  }

  return { ok: true, token: data.token };
}

function expireCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
    priority: "high",
    ...getAuthCookieScope(),
  });
}

/** Store the session token, clear legacy cookies, and set or clear the demo marker. */
export function setSessionCookies(
  response: NextResponse,
  token: string,
  { demo = false, maxAge = AUTH_COOKIE_MAX_AGE }: { demo?: boolean; maxAge?: number } = {},
) {
  const cookieScope = getAuthCookieScope();
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge,
    path: "/",
    priority: "high",
    ...cookieScope,
  });
  LEGACY_AUTH_COOKIE_NAMES.filter((name) => name !== AUTH_COOKIE_NAME).forEach(
    (name) => expireCookie(response, name),
  );

  if (demo) {
    response.cookies.set(DEMO_COOKIE_NAME, "1", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      ...cookieScope,
    });
  } else {
    expireCookie(response, DEMO_COOKIE_NAME);
  }

  return response;
}
