export type CreditCardTransaction = {
  id: number;
  budget_item: number;
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
  created_at: string;
};
