import type { ExpenseAutomationRunResult } from "@/lib/expense-automation-rule-types";

export function formatAutomationRunMessage(
  result: Pick<
    ExpenseAutomationRunResult,
    "created_count" | "skipped_duplicate_count"
  >,
): string {
  const parts: string[] = [];

  if (result.created_count === 0) {
    parts.push("No new expenses were created.");
  } else if (result.created_count === 1) {
    parts.push("Created 1 expense from matching transactions.");
  } else {
    parts.push(
      `Created ${result.created_count} expenses from matching transactions.`,
    );
  }

  if (result.skipped_duplicate_count > 0) {
    const noun =
      result.skipped_duplicate_count === 1 ? "record" : "records";
    parts.push(
      `${result.skipped_duplicate_count} existing ${noun} already created.`,
    );
  }

  return parts.join(" ");
}
