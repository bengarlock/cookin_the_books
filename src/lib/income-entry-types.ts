export type IncomeEntryBreakdown = {
  taxes?: Record<string, string>;
  deductions?: Record<string, string>;
  deposits?: Array<{
    account_last_four: string;
    amount: string;
  }>;
};

export type IncomeEntry = {
  id: number;
  employer: string;
  employee_name: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  gross_pay: string;
  net_pay: string;
  federal_taxable_wages: string | null;
  advice_number: string;
  source_type: string;
  source_identifier: string;
  statement_pdf_url: string;
  breakdown: IncomeEntryBreakdown;
  created_at: string;
  updated_at: string;
};
