export type ExpenseCategoryRule = {
  id: number;
  display_description: string;
  normalized_description: string;
  match_type: "exact" | "starts_with";
  category: string;
  created_at: string;
  updated_at: string;
};
