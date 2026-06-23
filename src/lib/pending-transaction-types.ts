import type { BankValueSnapshot } from "@/lib/snapshot-types";

export type PendingTransaction = {
  id: number;
  account: keyof BankValueSnapshot;
  note: string;
  amount: string;
  settled_accounts: Array<keyof BankValueSnapshot>;
  expected_post_date: string;
  is_cleared: boolean;
  cleared_at: string | null;
  created_at: string;
  updated_at: string;
};
