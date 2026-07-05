import type { ExpenseAutomationRunResult } from "@/lib/expense-automation-rule-types";

export function formatAutomationRunMessage(
  result: Pick<
    ExpenseAutomationRunResult,
    "processed_count"
  >,
): string {
  if (result.processed_count === 0) return "No records matched the active automations.";
  return `Automations reflowed ${result.processed_count} matching ${result.processed_count === 1 ? "record" : "records"}.`;
}
