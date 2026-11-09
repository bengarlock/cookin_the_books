import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { jsonResponseWithAuthHandling } from "@/lib/auth-responses";
import { loadOverviewRefresh } from "@/lib/overview-refresh";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

class OverviewReadError extends Error {
  constructor(public status: number) { super("Overview data could not be loaded."); }
}

export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return jsonResponseWithAuthHandling({ message: "Not authenticated." }, 401);
  try {
    const payload = await loadOverviewRefresh(async <T>(path: string): Promise<T> => {
      const response = await fetch(`${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/${path}`, {
        headers: { Accept: "application/json", Authorization: `Token ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new OverviewReadError(response.status);
      return response.json() as Promise<T>;
    });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonResponseWithAuthHandling(
      { message: "Overview data could not be loaded." },
      error instanceof OverviewReadError && error.status === 401 ? 401 : 502,
    );
  }
}
