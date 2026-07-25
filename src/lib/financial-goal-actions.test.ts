import { describe, expect, it } from "vitest";

import { financialGoalDeleteAction } from "./financial-goal-actions";

describe("financialGoalDeleteAction", () => {
  it("requires confirmation before deletion", () => {
    expect(financialGoalDeleteAction(null, 42)).toBe("confirm");
    expect(financialGoalDeleteAction(7, 42)).toBe("confirm");
  });

  it("allows deletion only after the same goal was confirmed", () => {
    expect(financialGoalDeleteAction(42, 42)).toBe("delete");
  });
});
