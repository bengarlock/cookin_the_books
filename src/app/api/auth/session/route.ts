import { NextResponse } from "next/server";

import { verifyPortfolioSession } from "@/lib/auth";

export async function GET() {
  const session = await verifyPortfolioSession();
  return NextResponse.json(session, {
    status: session.authenticated ? 200 : 401,
  });
}
