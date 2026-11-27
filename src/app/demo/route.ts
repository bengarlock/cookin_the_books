import { NextResponse } from "next/server";

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

// Behind nginx, request.url (and nextUrl) in a route handler carry the
// upstream host:port, so an absolute redirect would send visitors to
// localhost. A relative Location resolves against the public URL instead.
function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 307,
    headers: {
      "Cache-Control": "no-store",
      Location: `${APP_BASE_PATH}${path}`,
    },
  });
}

/**
 * Public entry point for the demo account: signs the visitor in with the
 * server-held demo credentials and drops them on the dashboard. The backend
 * confines demo users, so these credentials are safe to treat as public.
 */
export async function GET() {
  const credentials = demoCredentials();

  if (!credentials) {
    return new NextResponse(null, { status: 404 });
  }

  let result: Awaited<ReturnType<typeof requestPortfolioToken>>;
  try {
    result = await requestPortfolioToken(credentials.username, credentials.password);
  } catch {
    return redirectTo("/login?demo=unavailable");
  }

  if (!result.ok) {
    return redirectTo("/login?demo=unavailable");
  }

  const response = redirectTo("/dashboard");
  response.headers.set("X-Robots-Tag", "noindex");
  return setSessionCookies(response, result.token, {
    demo: true,
    maxAge: DEMO_SESSION_MAX_AGE,
  });
}
