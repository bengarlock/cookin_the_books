import type { Metadata } from "next";

import { ThemeSetting } from "@/components/theme-setting";

export const metadata: Metadata = { title: "Appearance settings" };

export default function AppearanceSettingsPage() {
  return <ThemeSetting />;
}
