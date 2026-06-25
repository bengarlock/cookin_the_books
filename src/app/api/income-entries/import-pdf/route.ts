import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { jsonResponseWithAuthHandling } from "@/lib/auth-responses";
import { readPdfImportResponse } from "@/lib/pdf-import";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export async function POST(request: Request) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/income-entries/import-pdf/`,
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
    const data = await readPdfImportResponse(
      response,
      "The income statement import failed.",
    );
    return jsonResponseWithAuthHandling(data, response.status);
  } catch {
    return NextResponse.json(
      { message: "The portfolio API is currently unavailable." },
      { status: 502 },
    );
  }
}
