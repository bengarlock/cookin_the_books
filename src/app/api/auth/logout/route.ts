import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { APP_BASE_PATH } from "@/lib/config";

function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
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
