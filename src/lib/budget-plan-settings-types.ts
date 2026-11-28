import type { AccountDisplayNames, AccountLoginUrls } from "./account-links";
import type { PaydayOverrides } from "./pay-cycle";

export type BudgetPlanSettings = {
  account_login_urls?: AccountLoginUrls;
  account_display_names?: AccountDisplayNames;
  budget_offset: string;
  next_payday_override: string | null;
  payday_overrides?: PaydayOverrides;
  overview_tile_order?: string[];
  navigation_preferences?: {
    budget_expanded?: boolean;
    calendar_show_completed?: boolean;
  };
  financial_reminder_email?: string;
  financial_reminder_notifications_enabled?: boolean;
  dismissed_financial_reminder_suggestions?: string[];
  account_email?: string;
  created_at?: string;
  updated_at?: string;
};
