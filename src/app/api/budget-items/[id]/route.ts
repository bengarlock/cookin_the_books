import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { portfolioApiJsonResponse } from "@/lib/auth-responses";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/budget-items/${encodeURIComponent(id)}/`,
      {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
        body: await request.text(),
        cache: "no-store",
      },
    );
    return portfolioApiJsonResponse(response, {
      message: "The budget item update failed.",
    });
  } catch {
    return NextResponse.json(
      { message: "The portfolio API is currently unavailable." },
      { status: 502 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/budget-items/${encodeURIComponent(id)}/`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    return portfolioApiJsonResponse(response, {
      message: "The expense deletion request failed.",
    });
  } catch {
    return NextResponse.json(
      { message: "The portfolio API is currently unavailable." },
      { status: 502 },
    );
  }
}
