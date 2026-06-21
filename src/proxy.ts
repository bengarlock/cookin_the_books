import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { APP_BASE_PATH } from "@/lib/config";

function withoutBasePath(pathname: string) {
  if (pathname === APP_BASE_PATH) {
    return "/";
  }

  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length);
  }

  return pathname;
}

export function proxy(request: NextRequest) {
  const pathname = withoutBasePath(request.nextUrl.pathname);
  const isProtectedRoute =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const hasToken = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (isProtectedRoute && !hasToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/cookinthebooks/dashboard/:path*"],
};
