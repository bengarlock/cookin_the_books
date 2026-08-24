import { describe, expect, it } from "vitest";

import { loginDestination } from "./login-destination";

describe("login destination", () => {
  it("preserves dashboard query parameters", () => {
    expect(loginDestination("/dashboard/calendar?reminder=42")).toBe(
      "/dashboard/calendar?reminder=42",
    );
  });

  it("accepts dashboard routes and rejects outside destinations", () => {
    expect(loginDestination("/dashboard")).toBe("/dashboard");
    expect(loginDestination("/dashboard/budget")).toBe("/dashboard/budget");
    expect(loginDestination("/dashboard-elsewhere")).toBe("/dashboard");
    expect(loginDestination("https://example.com/dashboard")).toBe("/dashboard");
    expect(loginDestination(null)).toBe("/dashboard");
  });
});
