import type { Metadata } from "next";

import { ReceiptInbox } from "@/components/receipt-inbox";

export const metadata: Metadata = { title: "Receipt settings" };

export default function ReceiptSettingsPage() {
  return <ReceiptInbox />;
}
