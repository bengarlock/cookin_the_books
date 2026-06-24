import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { readImportResponse } from "@/lib/pdf-import";
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
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/budget-items/${encodeURIComponent(id)}/import-credit-card/`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        body: await request.formData(),
        cache: "no-store",
      },
    );
    const data = await readImportResponse(
      response,
      "The credit-card import failed.",
    );
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "The portfolio API is currently unavailable." },
      { status: 502 },
    );
  }
}
