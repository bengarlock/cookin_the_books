import type { Metadata } from "next";
import { AccountLinkSettings } from "@/components/account-link-settings";
import { getBudgetPlanSettings } from "@/lib/budget-plan-settings";

export const metadata: Metadata = { title: "Account names & links" };

export default async function AccountLinksSettingsPage() {
  return <AccountLinkSettings initialSettings={await getBudgetPlanSettings()} />;
}
