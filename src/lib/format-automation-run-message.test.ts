import { describe, expect, it } from "vitest";

import { formatAutomationRunMessage } from "./format-automation-run-message";

describe("formatAutomationRunMessage", () => {
  it("reports the number of reflowed records", () => {
    expect(formatAutomationRunMessage({ processed_count: 2 })).toBe(
      "Automations reflowed 2 matching records.",
    );
  });

  it("uses singular record copy", () => {
    expect(formatAutomationRunMessage({ processed_count: 1 })).toBe(
      "Automations reflowed 1 matching record.",
    );
  });

  it("reports when no records matched", () => {
    expect(formatAutomationRunMessage({ processed_count: 0 })).toBe(
      "No records matched the active automations.",
    );
  });
});
