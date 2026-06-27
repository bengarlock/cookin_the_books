export type ExpenseEntry = {
  id: number;
  budget_item: number;
  incurred_on: string;
  amount: string;
  note: string;
  exclude_from_credit_card: boolean;
  source_type: string;
  source_identifier: string;
  utility_detail: UtilityBillDetail | null;
  created_at: string;
  updated_at: string;
};

export type UtilityBillDetail = {
  provider: string;
  account_number: string;
  invoice_number: string;
  bill_date: string;
  period_start: string;
  period_end: string;
  due_date: string;
  electric_meter_number: string;
  electric_days: number | null;
  electric_kwh: string | null;
  electric_delivery_charges: string | null;
  electric_supply_charges: string | null;
  electric_total_charges: string | null;
  gas_meter_number: string;
  gas_days: number | null;
  gas_therms: string | null;
  gas_delivery_charges: string | null;
  gas_supply_charges: string | null;
  gas_total_charges: string | null;
};
