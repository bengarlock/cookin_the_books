import type { ExpenseCategory } from "@/lib/expense-category-types";

const specialCategoryLabels: Record<string, string> = {
  needs_review: "Needs review",
  transfer: "Transfer",
};

export function categoryLabelMap(categories: ExpenseCategory[]) {
  return {
    ...Object.fromEntries(categories.map((category) => [category.key, category.label])),
    ...specialCategoryLabels,
  };
}

export function labelForCategory(
  value: string,
  categories: ExpenseCategory[],
  fallback = value,
) {
  return categoryLabelMap(categories)[value] || fallback;
}

export function sortedCategoryOptions(categories: ExpenseCategory[]) {
  return [...categories].sort((left, right) => left.label.localeCompare(right.label));
}

export function slugifyCategoryLabel(label: string) {
  return label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}
