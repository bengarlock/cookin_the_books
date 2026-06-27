import { describe, expect, it } from "vitest";

import { formatAutomationRunMessage } from "./format-automation-run-message";

describe("formatAutomationRunMessage", () => {
  it("reports only new expenses when duplicates were not encountered", () => {
    expect(
      formatAutomationRunMessage({
        created_count: 2,
        skipped_duplicate_count: 0,
      }),
    ).toBe("Created 2 expenses from matching transactions.");
  });

  it("reports duplicates when no new expenses were created", () => {
    expect(
      formatAutomationRunMessage({
        created_count: 0,
        skipped_duplicate_count: 2,
      }),
    ).toBe(
      "No new expenses were created. 2 existing records already created.",
    );
  });

  it("reports both new expenses and duplicates", () => {
    expect(
      formatAutomationRunMessage({
        created_count: 1,
        skipped_duplicate_count: 3,
      }),
    ).toBe(
      "Created 1 expense from matching transactions. 3 existing records already created.",
    );
  });
});
