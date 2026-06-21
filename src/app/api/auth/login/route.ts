import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
} from "@/lib/auth";
import {
  getPortfolioApiBaseUrl,
  PortfolioApiConfigurationError,
} from "@/lib/config";

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
    const backendResponse = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/login/`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
      },
    );

    const data = (await backendResponse.json().catch(() => null)) as {
      token?: string;
      message?: string;
    } | null;

    if (!backendResponse.ok || !data?.token) {
      return NextResponse.json(
        { message: data?.message || "Invalid username or password." },
        { status: backendResponse.status || 401 },
      );
    }

    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(AUTH_COOKIE_NAME, data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: "/",
      priority: "high",
    });

    return response;
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
