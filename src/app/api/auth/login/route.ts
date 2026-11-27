import { NextResponse } from "next/server";

import { requestPortfolioToken, setSessionCookies } from "@/lib/portfolio-login";
import { PortfolioApiConfigurationError } from "@/lib/server-config";

type LoginPayload = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  let payload: LoginPayload;

  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json(
      { message: "A valid username and password are required." },
      { status: 400 },
    );
  }

  const username = payload.username?.trim();
  const password = payload.password;

  if (!username || !password) {
    return NextResponse.json(
      { message: "Username and password are required." },
      { status: 400 },
    );
  }

  try {
    const result = await requestPortfolioToken(username, password);

    if (!result.ok) {
      return NextResponse.json(
        { message: result.message },
        { status: result.status },
      );
    }

    return setSessionCookies(
      NextResponse.json({ authenticated: true }),
      result.token,
    );
  } catch (error) {
    if (error instanceof PortfolioApiConfigurationError) {
      return NextResponse.json(
        { message: "The portfolio API is not configured for this environment." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "The portfolio API is currently unavailable." },
      { status: 502 },
    );
  }
}
