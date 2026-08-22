import { describe, expect, it } from "vitest";

import {
  budgetPlanNavigationSource,
  isBudgetPlanNavigationPending,
} from "./budget-plan-navigation";

describe("budget plan navigation", () => {
  it("starts an optimistic Plan transition from another Budget page", () => {
    const sourcePathname = budgetPlanNavigationSource({
      appBasePath: "/cookinthebooks",
      currentPathname: "/dashboard/budget/income",
      destinationPathname: "/cookinthebooks/dashboard/budget",
    });

    expect(sourcePathname).toBe("/dashboard/budget/income");
    expect(
      isBudgetPlanNavigationPending({
        currentPathname: "/dashboard/budget/income",
        sourcePathname,
      }),
    ).toBe(true);
  });

  it("stops the optimistic transition when Plan becomes current", () => {
    expect(
      isBudgetPlanNavigationPending({
        currentPathname: "/dashboard/budget",
        sourcePathname: "/dashboard/budget/income",
      }),
    ).toBe(false);
  });

  it("does not treat sibling Budget destinations as Plan", () => {
    expect(
      budgetPlanNavigationSource({
        appBasePath: "/cookinthebooks",
        currentPathname: "/dashboard/budget/income",
        destinationPathname: "/cookinthebooks/dashboard/budget/expenses",
      }),
    ).toBeNull();
  });

  it("does not replace unrelated dashboard pages with the Budget shell", () => {
    expect(
      budgetPlanNavigationSource({
        appBasePath: "/cookinthebooks",
        currentPathname: "/dashboard/accounts",
        destinationPathname: "/cookinthebooks/dashboard/budget",
      }),
    ).toBeNull();
  });
});
