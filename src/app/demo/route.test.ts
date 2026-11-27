import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

const { GET } = await import("./route");

const request = new NextRequest("https://bengarlock.com/cookinthebooks/demo", {
  nextConfig: { basePath: "/cookinthebooks" },
});

function mockBackend(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("GET /demo", () => {
  beforeEach(() => {
    vi.stubEnv("PORTFOLIO_API_BASE_URL", "https://api.example.test");
    vi.stubEnv("DEMO_USERNAME", "demo");
    vi.stubEnv("DEMO_PASSWORD", "demo-pass");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is not found when demo credentials are not configured", async () => {
    vi.stubEnv("DEMO_PASSWORD", "");
    const fetchMock = mockBackend(Response.json({}));

    const response = await GET(request);

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs in with the server-held credentials and opens the dashboard", async () => {
    const fetchMock = mockBackend(Response.json({ token: "demo-token", valid: true }));

    const response = await GET(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/login/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "demo", password: "demo-pass" }),
      }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://bengarlock.com/cookinthebooks/dashboard",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toMatch(/cookinTheBooksToken=demo-token|portfolioAuthToken=demo-token/);
    expect(cookies).toMatch(/Max-Age=86400/);
    expect(cookies).toMatch(/cookinTheBooksDemo=1/);
    expect(cookies).toMatch(/HttpOnly/i);
  });

  it("falls back to the login page when the backend rejects the demo login", async () => {
    mockBackend(Response.json({ message: "Invalid" }, { status: 400 }));

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      "https://bengarlock.com/cookinthebooks/login?demo=unavailable",
    );
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("falls back to the login page when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      "https://bengarlock.com/cookinthebooks/login?demo=unavailable",
    );
  });
});

describe("POST /api/auth/login", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("clears the demo marker when someone signs in with their own account", async () => {
    vi.stubEnv("PORTFOLIO_API_BASE_URL", "https://api.example.test");
    mockBackend(Response.json({ token: "real-token", valid: true }));
    const { POST } = await import("../api/auth/login/route");

    const response = await POST(
      new Request("https://bengarlock.com/cookinthebooks/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "ben", password: "secret" }),
      }),
    );

    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toMatch(/=real-token/);
    expect(cookies).toMatch(/cookinTheBooksDemo=;.*Max-Age=0/);
  });
});
