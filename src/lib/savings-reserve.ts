export const SAVINGS_RESERVE_TARGET = 30_000;

export function getSavingsReservePosition(
  currentBalance: number,
  target = SAVINGS_RESERVE_TARGET,
) {
  const variance = currentBalance - target;

  return {
    target,
    variance,
    restorationNeeded: Math.max(0, -variance),
  };
}
