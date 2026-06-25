import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { jsonResponseWithAuthHandling } from "@/lib/auth-responses";
import { isBackendInvalidTokenResponse } from "@/lib/auth-invalidation";
import {
  getPortfolioApiBaseUrl,
  getPortfolioWebSocketBaseUrl,
} from "@/lib/server-config";

type TicketResponse = {
  ticket?: string;
  websocket_path?: string;
};

export async function POST() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/bank-value-snapshots/websocket-ticket/`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );

    const data = (await response.json().catch(() => null)) as TicketResponse | null;
    if (isBackendInvalidTokenResponse(response.status)) {
      return jsonResponseWithAuthHandling(data, response.status);
    }

    if (!response.ok || !data?.ticket || !data.websocket_path) {
      return NextResponse.json(
        { message: "Unable to authorize the live snapshot connection." },
        { status: response.status || 502 },
      );
    }

    const url = new URL(data.websocket_path, getPortfolioWebSocketBaseUrl());
    url.searchParams.set("ticket", data.ticket);
    return NextResponse.json({ url: url.toString() });
  } catch {
    return NextResponse.json(
      { message: "The live snapshot service is unavailable." },
      { status: 502 },
    );
  }
}
