import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { APP_BASE_PATH } from "@/lib/config";
import { DEMO_COOKIE_NAME, DEMO_ENTRY_PATH } from "@/lib/demo";

function withoutBasePath(pathname: string) {
  if (pathname === APP_BASE_PATH) {
    return "/";
  }

  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length);
  }

  return pathname;
}

function loginRedirect(request: NextRequest, pathname: string) {
  const loginUrl = request.nextUrl.clone();
  const destination = `${pathname}${request.nextUrl.search}`;
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", destination);
  return NextResponse.redirect(loginUrl);
}

export function proxy(request: NextRequest) {
  const pathname = withoutBasePath(request.nextUrl.pathname);
  const isProtectedRoute =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (isProtectedRoute && !token) {
    if (request.cookies.get(DEMO_COOKIE_NAME)?.value) {
      const demoUrl = request.nextUrl.clone();
      demoUrl.pathname = DEMO_ENTRY_PATH;
      demoUrl.search = "";
      return NextResponse.redirect(demoUrl);
    }

    return loginRedirect(request, pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/cookinthebooks/dashboard/:path*"],
};
