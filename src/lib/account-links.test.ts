import { describe, expect, it } from "vitest";
import { accountDisplayName, accountLoginUrl } from "./account-links";

describe("account portal links", () => {
  it("uses a per-account override, including a deep link fragment", () => {
    const custom = "https://secure.chase.com/web/auth/dashboard#/dashboard/summary/card";
    expect(accountLoginUrl("chase_credit_8506", { chase_credit_8506: custom })).toBe(custom);
    expect(accountLoginUrl("chase_credit", { chase_credit_8506: custom })).not.toBe(custom);
  });
  it("provides defaults, including the newer Chase account", () => {
    expect(accountLoginUrl("chase_credit_8506")).toContain("https://secure.chase.com/");
  });
  it("does not render unsafe or invalid stored links", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,test", "/relative", "https://user:password@example.com", "invalid"]) {
      expect(accountLoginUrl("chase_credit", { chase_credit: value })).toBeNull();
    }
  });
});

describe("account display names", () => {
  it("uses a custom name without changing another account", () => {
    expect(accountDisplayName("chase_credit_8506", { chase_credit_8506: "  Travel card  " })).toBe("Travel card");
    expect(accountDisplayName("chase_credit", { chase_credit_8506: "Travel card" })).toBe("Chase Mastercard");
  });
  it("restores default names for empty or missing overrides", () => {
    expect(accountDisplayName("chase_credit_8506", { chase_credit_8506: "   " })).toBe("Chase Credit Card •••• 8506");
    expect(accountDisplayName("chase_credit_8506")).toBe("Chase Credit Card •••• 8506");
  });
});
