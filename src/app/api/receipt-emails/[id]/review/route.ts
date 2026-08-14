import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { portfolioApiJsonResponse } from "@/lib/auth-responses";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

async function reviewRequest(request: Request, id: string) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/receipt-emails/${encodeURIComponent(id)}/review/`,
      {
        method: request.method,
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
          ...(request.method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        body: request.method === "POST" ? await request.text() : undefined,
        cache: "no-store",
      },
    );
    return portfolioApiJsonResponse(response, { message: "The receipt review could not be completed." });
  } catch {
    return NextResponse.json({ message: "The portfolio API is currently unavailable." }, { status: 502 });
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return reviewRequest(request, id);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return reviewRequest(request, id);
}
