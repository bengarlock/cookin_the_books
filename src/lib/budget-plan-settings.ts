import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import type { BudgetPlanSettings } from "@/lib/budget-plan-settings-types";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export const getBudgetPlanSettings = cache(async (): Promise<BudgetPlanSettings> => {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return {
      budget_offset: "0.00",
      next_payday_override: null,
      navigation_preferences: {},
    };
  }

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/budget-plan-settings/`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return {
        budget_offset: "0.00",
        next_payday_override: null,
        navigation_preferences: {},
      };
    }
    return (await response.json()) as BudgetPlanSettings;
  } catch {
    return {
      budget_offset: "0.00",
      next_payday_override: null,
      navigation_preferences: {},
    };
  }
});
