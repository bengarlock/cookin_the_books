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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || `${APP_BASE_PATH}/login`;
  const response = NextResponse.redirect(new URL(next, url));
  return clearAuthCookie(response);
}

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  return clearAuthCookie(response);
}
