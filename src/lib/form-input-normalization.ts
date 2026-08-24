export function normalizeCurrencyInput(value: string) {
  const trimmed = value.trim();
  const parenthesized = /^\(.*\)$/.test(trimmed);
  const normalized = trimmed.replace(/[$,\s()]/g, "");
  if (!/^-?\d*(?:\.\d{0,2})?$/.test(normalized)) return null;
  return parenthesized ? `-${normalized}` : normalized;
}

export function isValidCurrencyInput(value: string) {
  return normalizeCurrencyInput(value) !== null;
}

export function normalizeDateInput(value: string) {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  const usMatch = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/.exec(trimmed);
  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : usMatch
      ? {
          year: usMatch[3].length === 2 ? 2000 + Number(usMatch[3]) : Number(usMatch[3]),
          month: Number(usMatch[1]),
          day: Number(usMatch[2]),
        }
      : null;
  if (!parts) return null;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  if (
    date.getFullYear() !== parts.year ||
    date.getMonth() !== parts.month - 1 ||
    date.getDate() !== parts.day
  ) return null;
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}
