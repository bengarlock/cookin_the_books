import { describe, expect, it } from "vitest";

import type { IncomeEntry } from "./income-entry-types";
import { mergeImportedIncomeEntries } from "./merge-imported-income-entries";

function incomeEntry(id: number, gross = "4154.17"): IncomeEntry {
  return {
    id,
    employer: "Imported employer",
    employee_name: "",
    period_start: "2026-09-01",
    period_end: "2026-09-15",
    pay_date: "2026-09-15",
    gross_pay: gross,
    net_pay: "2497.22",
    federal_taxable_wages: null,
    advice_number: "",
    source_type: "income_statement_pdf",
    source_identifier: `entry-${id}`,
    statement_pdf_url: "",
    breakdown: {},
    created_at: "2026-11-28T00:00:00Z",
    updated_at: "2026-11-28T00:00:00Z",
  };
}

describe("mergeImportedIncomeEntries", () => {
  it("adds an entry reported several times in one import only once", () => {
    const existing = incomeEntry(1);
    const imported = incomeEntry(2);

    const merged = mergeImportedIncomeEntries(
      [existing],
      [imported, imported, imported, imported, imported],
    );

    expect(merged.map((entry) => entry.id)).toEqual([2, 1]);
  });

  it("replaces existing entries in place with the latest imported copy", () => {
    const merged = mergeImportedIncomeEntries(
      [incomeEntry(1), incomeEntry(2)],
      [incomeEntry(2, "100.00"), incomeEntry(2, "200.00")],
    );

    expect(merged.map((entry) => [entry.id, entry.gross_pay])).toEqual([
      [1, "4154.17"],
      [2, "200.00"],
    ]);
  });
});
