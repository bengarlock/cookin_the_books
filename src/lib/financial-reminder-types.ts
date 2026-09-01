export type ReminderCadence = "once" | "daily" | "weekly" | "monthly";
export type ReminderRecurrence =
  | "none"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";
export type CustomRecurrenceType = "month_day" | "interval_days";

export type FinancialReminder = {
  id: number;
  title: string;
  // Signed dollars: negative costs, positive incoming payments.
  amount: string | null;
  due_date: string;
  notes: string;
  reminder_lead_days: number;
  reminder_cadence: ReminderCadence;
  recurrence_frequency: ReminderRecurrence;
  custom_recurrence_type: CustomRecurrenceType | null;
  custom_recurrence_value: number | null;
  email_enabled: boolean;
  homepage_enabled: boolean;
  // Enables notifications only; the calendar event remains active and editable.
  is_enabled: boolean;
  is_completed: boolean;
  completed_at: string | null;
  active_on_homepage: boolean;
  days_until_due: number;
  notification_due_date?: string;
  notification_days_until_due?: number;
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
  | "recurrence_frequency"
  | "custom_recurrence_type"
  | "custom_recurrence_value"
  | "email_enabled"
  | "homepage_enabled"
  | "is_enabled"
>;
