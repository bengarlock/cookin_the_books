import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { portfolioApiJsonResponse } from "@/lib/auth-responses";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

async function suggestionsRequest(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  const { id } = await context.params;
  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/credit-card-transactions/${encodeURIComponent(id)}/relationship-suggestions/?include_unbudgeted=true`,
      {
        method: request.method,
        headers: { Accept: "application/json", Authorization: `Token ${token}`, "Content-Type": "application/json" },
        body: request.method === "DELETE" ? await request.text() : undefined,
        cache: "no-store",
      },
    );
    return portfolioApiJsonResponse(response, { message: "Transaction suggestions could not be loaded." });
  } catch {
    return NextResponse.json({ message: "The portfolio API is currently unavailable." }, { status: 502 });
  }
}

export const GET = suggestionsRequest;
export const DELETE = suggestionsRequest;
