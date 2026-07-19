import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { portfolioApiJsonResponse } from "@/lib/auth-responses";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

async function proxyRequest(method: "GET" | "PATCH", request?: Request) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });

  const response = await fetch(
    `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/receipt-mailbox-settings/`,
    {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Token ${token}`,
        ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "PATCH" && request ? await request.text() : undefined,
      cache: "no-store",
    },
  );
  return portfolioApiJsonResponse(response, {
    message: "The receipt mailbox settings request failed.",
  });
}

export async function GET() {
  try {
    return await proxyRequest("GET");
  } catch {
    return NextResponse.json({ message: "The portfolio API is currently unavailable." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  try {
    return await proxyRequest("PATCH", request);
  } catch {
    return NextResponse.json({ message: "The portfolio API is currently unavailable." }, { status: 502 });
  }
}
