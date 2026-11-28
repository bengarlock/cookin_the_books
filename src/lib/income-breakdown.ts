/**
 * Withheld amounts from a statement breakdown. Statements store current-period
 * amounts with ADP's sign: negative when withheld from a paycheck, positive
 * when a reversal returns it, so a return counts against the total.
 */
export function breakdownEntries(
  breakdown: Record<string, string> | undefined,
  { excludeLabels = [] }: { excludeLabels?: string[] } = {},
) {
  const excluded = new Set(excludeLabels.map((label) => label.toLowerCase()));
  return Object.entries(breakdown || {})
    .filter(([label]) => !excluded.has(label.toLowerCase()))
    .map(([label, value]) => [label, -Number(value)] as const)
    .filter(([, value]) => Number.isFinite(value) && value !== 0)
    .sort(([leftLabel], [rightLabel]) => leftLabel.localeCompare(rightLabel));
}

export function sumBreakdown(
  breakdown: Record<string, string> | undefined,
  options?: { excludeLabels?: string[] },
) {
  return breakdownEntries(breakdown, options).reduce(
    (total, [, value]) => total + value,
    0,
  );
}
