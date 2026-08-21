import { describe, expect, it } from "vitest";

import { getAuthCookieScope } from "./auth-cookie-options";

describe("getAuthCookieScope", () => {
  it("keeps secure cross-subdomain cookies as the production default", () => {
    expect(getAuthCookieScope({ NODE_ENV: "production" })).toEqual({
      secure: true,
      domain: ".bengarlock.com",
    });
  });

  it("allows an HTTP staging host to use a host-only cookie", () => {
    expect(
      getAuthCookieScope({
        NODE_ENV: "production",
        AUTH_COOKIE_SECURE: "false",
        AUTH_COOKIE_DOMAIN: "",
      }),
    ).toEqual({ secure: false });
  });

  it("uses host-only non-secure cookies in development", () => {
    expect(getAuthCookieScope({ NODE_ENV: "development" })).toEqual({
      secure: false,
    });
  });
});
