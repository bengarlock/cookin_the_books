import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { portfolioApiJsonResponse } from "@/lib/auth-responses";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const search = new URL(request.url).search;
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/credit-card-transactions/${encodeURIComponent(id)}/auto-categorize/${search}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );
    return portfolioApiJsonResponse(response, {
      message: "Auto categorization failed.",
    });
  } catch {
    return NextResponse.json(
      { message: "The portfolio API is currently unavailable." },
      { status: 502 },
    );
  }
}
