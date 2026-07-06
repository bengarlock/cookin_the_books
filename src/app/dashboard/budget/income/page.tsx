import type { Metadata } from "next";

import { IncomeHistory } from "@/components/income-history";

export const metadata: Metadata = {
  title: "Income",
};

export default function IncomePage() {
  return <IncomeHistory />;
}
