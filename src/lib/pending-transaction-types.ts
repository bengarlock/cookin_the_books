import type { BankValueSnapshot } from "@/lib/snapshot-types";

export type PendingTransaction = {
  id: number;
  account: keyof BankValueSnapshot;
  note: string;
  amount: string;
  expected_post_date: string;
  is_cleared: boolean;
  cleared_at: string | null;
  created_at: string;
  updated_at: string;
};
