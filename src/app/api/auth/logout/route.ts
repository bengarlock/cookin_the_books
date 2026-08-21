import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, LEGACY_AUTH_COOKIE_NAMES } from "@/lib/auth";
import { getAuthCookieScope } from "@/lib/auth-cookie-options";
import { APP_BASE_PATH } from "@/lib/config";

function clearAuthCookie(response: NextResponse) {
  const cookieScope = getAuthCookieScope();
  [AUTH_COOKIE_NAME, ...LEGACY_AUTH_COOKIE_NAMES].forEach((name) => response.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
    ...cookieScope,
  }));
  return response;
}

function redirectPathWithBasePath(path: string | null) {
  const nextPath = path || "/login";

  if (!nextPath.startsWith("/")) {
    return `${APP_BASE_PATH}/login`;
  }

  if (nextPath === APP_BASE_PATH || nextPath.startsWith(`${APP_BASE_PATH}/`)) {
    return nextPath;
  }

  return `${APP_BASE_PATH}${nextPath}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = redirectPathWithBasePath(url.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, url));
  return clearAuthCookie(response);
}

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  return clearAuthCookie(response);
}
