import type { Metadata } from "next";

import { ReminderEmailSetting } from "@/components/reminder-email-setting";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const settings = await getBudgetPlanSettings();

  return <ReminderEmailSetting initialSettings={settings} />;
}
