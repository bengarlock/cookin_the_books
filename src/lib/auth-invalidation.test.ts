import { describe, expect, it } from "vitest";

import { isBackendInvalidTokenResponse } from "./auth-invalidation";

describe("isBackendInvalidTokenResponse", () => {
  it("treats backend 401 responses as invalid sessions", () => {
    expect(isBackendInvalidTokenResponse(401)).toBe(true);
  });

  it("does not invalidate the session for normal authorization or server errors", () => {
    expect(isBackendInvalidTokenResponse(403)).toBe(false);
    expect(isBackendInvalidTokenResponse(500)).toBe(false);
  });
});
