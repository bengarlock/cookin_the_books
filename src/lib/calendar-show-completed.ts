export function calendarShowCompletedPreference(
  savedPreference: boolean | undefined,
) {
  return savedPreference ?? true;
}
