export function financialGoalDeleteAction(
  confirmingDeleteId: number | null,
  goalId: number,
) {
  return confirmingDeleteId === goalId ? "delete" : "confirm";
}
