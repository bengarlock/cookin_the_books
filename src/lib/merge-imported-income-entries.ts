import type { IncomeEntry } from "@/lib/income-entry-types";

/**
 * Merge entries returned by a statement import into the current list.
 *
 * One upload can report the same entry more than once (for example, several
 * PDFs that resolve to one statement come back as one "created" plus repeated
 * "updated" copies), so entries are keyed by id and the last copy wins.
 */
export function mergeImportedIncomeEntries(
  current: IncomeEntry[],
  changed: IncomeEntry[],
): IncomeEntry[] {
  const changedById = new Map(changed.map((entry) => [entry.id, entry]));
  const currentIds = new Set(current.map((entry) => entry.id));
  const merged = current.map((entry) => changedById.get(entry.id) || entry);
  const newEntries = [...changedById.values()].filter(
    (entry) => !currentIds.has(entry.id),
  );
  return [...newEntries, ...merged];
}
