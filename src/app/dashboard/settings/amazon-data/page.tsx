import type { Metadata } from "next";

import { AmazonOrderImport } from "@/components/amazon-order-import";

export const metadata: Metadata = { title: "Amazon data settings" };

export default function AmazonDataSettingsPage() {
  return <AmazonOrderImport />;
}
