import "server-only";

import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import {
  AUTH_INVALIDATED_HEADER,
  isBackendInvalidTokenResponse,
} from "@/lib/auth-invalidation";

type JsonPayload = Record<string, unknown> | unknown[] | string | number | boolean | null;

function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

function withInvalidatedSession(response: NextResponse) {
  response.headers.set(AUTH_INVALIDATED_HEADER, "1");
  clearAuthCookie(response);
  return response;
}

function invalidatedPayload(data: JsonPayload) {
  const fallback = {
    message: "Your session expired. Please sign in again.",
    sessionExpired: true,
  };

  if (data && typeof data === "object" && !Array.isArray(data)) {
    return {
      ...data,
      sessionExpired: true,
      message:
        "message" in data && typeof data.message === "string"
          ? data.message
          : fallback.message,
    };
  }

  return fallback;
}

export function jsonResponseWithAuthHandling(data: JsonPayload, status: number) {
  const isInvalidSession = isBackendInvalidTokenResponse(status);
  const response = NextResponse.json(
    isInvalidSession ? invalidatedPayload(data) : data,
    { status },
  );

  return isInvalidSession ? withInvalidatedSession(response) : response;
}

export async function portfolioApiJsonResponse(
  response: Response,
  fallbackPayload: JsonPayload,
) {
  const data = (await response.json().catch(() => fallbackPayload)) as JsonPayload;
  return jsonResponseWithAuthHandling(data, response.status);
}
