import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import type { ExpenseCategory } from "@/lib/expense-category-types";
import { getPortfolioApiBaseUrl } from "@/lib/server-config";

export const fallbackExpenseCategories: ExpenseCategory[] = [
  { id: 0, key: "dining", label: "Dining", is_default: true, created_at: "", updated_at: "" },
  { id: 0, key: "groceries", label: "Groceries", is_default: true, created_at: "", updated_at: "" },
  { id: 0, key: "transportation", label: "Transportation", is_default: true, created_at: "", updated_at: "" },
  { id: 0, key: "housing", label: "Housing", is_default: true, created_at: "", updated_at: "" },
  { id: 0, key: "utilities", label: "Utilities", is_default: true, created_at: "", updated_at: "" },
  { id: 0, key: "shopping", label: "Shopping", is_default: true, created_at: "", updated_at: "" },
  { id: 0, key: "health", label: "Health", is_default: true, created_at: "", updated_at: "" },
  { id: 0, key: "entertainment", label: "Entertainment", is_default: true, created_at: "", updated_at: "" },
  { id: 0, key: "travel", label: "Travel", is_default: true, created_at: "", updated_at: "" },
  { id: 0, key: "subscriptions", label: "Subscriptions", is_default: true, created_at: "", updated_at: "" },
  { id: 0, key: "fees_interest", label: "Fees & interest", is_default: true, created_at: "", updated_at: "" },
  { id: 0, key: "account_payment", label: "Account Payment", is_default: true, created_at: "", updated_at: "" },
];

export const getExpenseCategories = cache(async (): Promise<ExpenseCategory[]> => {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return fallbackExpenseCategories;

  try {
    const response = await fetch(
      `${getPortfolioApiBaseUrl()}/api/v1/cookin_the_books/expense-categories/`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) return fallbackExpenseCategories;
    return (await response.json()) as ExpenseCategory[];
  } catch {
    return fallbackExpenseCategories;
  }
});
