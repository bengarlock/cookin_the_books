import type { SnapshotAccountKey } from "@/lib/snapshot-types";
import type { CreditCardTransaction } from "@/lib/credit-card-transaction-types";

export type PendingTransaction = {
  id: number;
  account: SnapshotAccountKey;
  note: string;
  amount: string;
  settled_accounts: SnapshotAccountKey[];
  expected_post_date: string;
  is_cleared: boolean;
  cleared_at: string | null;
  matched_transaction: number | null;
  matched_transaction_detail: CreditCardTransaction | null;
  match_status: "none" | "suggested" | "matched_pending" | "reconciled" | "rejected";
  match_confidence: string | null;
  match_method: string;
  matched_at: string | null;
  created_at: string;
  updated_at: string;
};
