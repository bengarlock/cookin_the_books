export type ReminderCadence = "once" | "daily" | "weekly" | "monthly";

export type FinancialReminder = {
  id: number;
  title: string;
  amount: string | null;
  due_date: string;
  notes: string;
  reminder_lead_days: number;
  reminder_cadence: ReminderCadence;
  email_enabled: boolean;
  homepage_enabled: boolean;
  is_completed: boolean;
  completed_at: string | null;
  active_on_homepage: boolean;
  days_until_due: number;
  created_at: string;
  updated_at: string;
};

export type FinancialReminderPayload = Pick<
  FinancialReminder,
  | "title"
  | "amount"
  | "due_date"
  | "notes"
  | "reminder_lead_days"
  | "reminder_cadence"
  | "email_enabled"
  | "homepage_enabled"
>;
