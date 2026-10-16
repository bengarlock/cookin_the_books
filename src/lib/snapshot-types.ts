export type SnapshotAccountKey =
  | "chase_checking"
  | "chase_savings"
  | "chase_credit"
  | "chase_credit_8506"
  | "citi_current"
  | "citi_pending"
  | "barclays_card"
  | "etrade"
  | "betterment_general"
  | "betterment_safety"
  | "betterment_retirement"
  | "fidelity_retirement";

export type SnapshotAccountBalance = {
  id: number;
  account: number | null;
  account_key: SnapshotAccountKey;
  account_name: string;
  balance: string;
  metadata: Record<string, unknown>;
};

export type BankValueSnapshot = {
  id: number;
  chase_checking: string;
  chase_savings: string;
  chase_credit: string;
  chase_credit_8506: string;
  citi_current: string;
  citi_pending: string;
  barclays_card: string;
  etrade: string;
  betterment_general: string;
  betterment_safety: string;
  betterment_retirement: string;
  fidelity_retirement: string;
  source_updated_at: string;
  snapshot_date: string;
  net_assets: string;
  change: string;
  change_percentage: string;
  is_highpoint: boolean;
  last_highpoint_snapshot_id: number;
  last_highpoint_date: string;
  last_highpoint_net_assets: string;
  loss_since_highpoint: string;
  loss_since_highpoint_percentage: string;
  archived_account_keys?: SnapshotAccountKey[];
  notes: string;
  metadata: Record<string, unknown>;
  account_balances?: SnapshotAccountBalance[];
  is_editable: boolean;
  created_at: string;
  updated_at: string;
};
