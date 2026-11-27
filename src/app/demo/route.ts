import { NextResponse, type NextRequest } from "next/server";

import { APP_BASE_PATH } from "@/lib/config";
import { requestPortfolioToken, setSessionCookies } from "@/lib/portfolio-login";

// Demo tokens expire at midnight anyway; a short cookie keeps a stale demo
// session from lingering in a visitor's browser.
const DEMO_SESSION_MAX_AGE = 60 * 60 * 24;

function demoCredentials() {
  const username = process.env.DEMO_USERNAME?.trim();
  const password = process.env.DEMO_PASSWORD;
  return username && password ? { username, password } : null;
}

// Build redirects from nextUrl (like proxy.ts) rather than request.url: behind
// nginx, request.url carries the internal host:port, not the public host.
function appUrl(request: NextRequest, path: string) {
  return new URL(`${APP_BASE_PATH}${path}`, request.nextUrl.origin);
}

function demoUnavailable(request: NextRequest) {
  const response = NextResponse.redirect(
    appUrl(request, "/login?demo=unavailable"),
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * Public entry point for the demo account: signs the visitor in with the
 * server-held demo credentials and drops them on the dashboard. The backend
 * confines demo users, so these credentials are safe to treat as public.
 */
export async function GET(request: NextRequest) {
  const credentials = demoCredentials();

  if (!credentials) {
    return new NextResponse(null, { status: 404 });
  }

  let result: Awaited<ReturnType<typeof requestPortfolioToken>>;
  try {
    result = await requestPortfolioToken(credentials.username, credentials.password);
  } catch {
    return demoUnavailable(request);
  }

  if (!result.ok) {
    return demoUnavailable(request);
  }

  const response = NextResponse.redirect(appUrl(request, "/dashboard"));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex");
  return setSessionCookies(response, result.token, {
    demo: true,
    maxAge: DEMO_SESSION_MAX_AGE,
  });
}
