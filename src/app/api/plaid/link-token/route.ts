import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { portfolioApiJsonResponse } from "@/lib/auth-responses";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export async function POST() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/plaid/link-token/`,
      {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Token ${token}` },
        cache: "no-store",
      },
    );
    return portfolioApiJsonResponse(response, { message: "Plaid Link could not be started." });
  } catch {
    return NextResponse.json({ message: "The portfolio API is currently unavailable." }, { status: 502 });
  }
}
