export type PlaidAccount = {
  id: number;
  account_id: string;
  name: string;
  official_name: string;
  account_type: string;
  subtype: string;
  mask: string;
  budget_item: number | null;
};

export type PlaidConnection = {
  id: number;
  item_id: string;
  institution_id: string;
  institution_name: string;
  status: string;
  error_code: string;
  last_synced_at: string | null;
  accounts: PlaidAccount[];
  created_at: string;
  updated_at: string;
};

export type PlaidSyncResult = {
  connection: PlaidConnection;
  sync: {
    created_count: number;
    updated_count: number;
    removed_count: number;
  };
};
