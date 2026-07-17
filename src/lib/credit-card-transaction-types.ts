export type ExpenseTag = { id: number; name: string };

export type CreditCardTransaction = {
  id: number;
  budget_item: number | null;
  issuer: string;
  account_last_four: string;
  statement_start: string;
  statement_end: string;
  transaction_date: string;
  posting_date: string | null;
  description: string;
  amount: string;
  transaction_type: "purchase" | "payment" | "credit" | "fee" | "interest";
  source_identifier: string;
  category: string;
  category_confidence: string | null;
  category_source: "ai" | "rules" | "user" | "user_rule" | "plaid" | "";
  categorized_at: string | null;
  tags: ExpenseTag[];
  split: boolean;
  include: boolean;
  note: string;
  plaid_category_primary: string;
  plaid_category_detailed: string;
  plaid_category_confidence: string;
  plaid_category_icon_url: string;
  plaid_legacy_categories: string[];
  plaid_legacy_category_id: string;
  plaid_payment_channel: string;
  plaid_transaction_type: string;
  plaid_counterparty_name: string;
  plaid_counterparty_type: string;
  plaid_counterparty_entity_id: string;
  pending: boolean;
  manual_match: {
    pending_transaction_id: number;
    note: string;
    status: "matched_pending" | "reconciled";
    matched_at: string;
  } | null;
  related_transactions: RelatedTransaction[];
  amazon_orders?: AmazonOrder[];
  created_at: string;
};

export type AmazonProduct = {
  id: number;
  website: string;
  asin: string;
  name: string;
  purchase_count: number;
};

export type AmazonOrderItem = {
  id: number;
  product: AmazonProduct;
  quantity: number;
  unit_price: string | null;
  subtotal: string | null;
  tax: string | null;
  discount: string | null;
  total_amount: string;
  tags: ExpenseTag[];
};

export type AmazonOrder = {
  id: number;
  order_id: string;
  website: string;
  order_date: string | null;
  ship_date: string | null;
  status: string;
  payment_method: string;
  total_amount: string;
  match_difference: string | null;
  match_method: "exact" | "near" | "";
  items: AmazonOrderItem[];
};

export type RelatedTransaction = {
  id: number;
  description: string;
  transaction_date: string;
  issuer: string;
  account_last_four: string;
  amount: string;
  transaction_type: CreditCardTransaction["transaction_type"];
  category: string;
  tags: ExpenseTag[];
};

export type SuggestedRelatedTransaction = CreditCardTransaction & {
  match_reason: string;
  match_score: number;
};
