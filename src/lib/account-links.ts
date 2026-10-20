import type { SnapshotAccountKey } from "./snapshot-types";

export const accountLinkAccounts: Array<{
  key: SnapshotAccountKey;
  label: string;
  category: string;
}> = [
  { key: "chase_checking", label: "Chase Checking", category: "Cash" },
  { key: "chase_savings", label: "Chase Savings", category: "Cash" },
  { key: "chase_credit", label: "Chase Mastercard", category: "Liability" },
  { key: "chase_credit_8506", label: "Chase Credit Card •••• 8506", category: "Liability" },
  { key: "citi_current", label: "Citi Card — Current", category: "Liability" },
  { key: "citi_pending", label: "Citi Card — Pending", category: "Pending" },
  { key: "barclays_card", label: "Barclaycard", category: "Liability" },
  { key: "etrade", label: "E*TRADE", category: "Investment" },
  {
    key: "betterment_general",
    label: "Betterment — General",
    category: "Investment",
  },
  {
    key: "betterment_safety",
    label: "Betterment — Safety Net",
    category: "Investment",
  },
  {
    key: "betterment_retirement",
    label: "Betterment — Retirement",
    category: "Retirement",
  },
  {
    key: "fidelity_retirement",
    label: "Fidelity 401(k)",
    category: "Retirement",
  },
];

export type AccountLoginUrls = Partial<Record<SnapshotAccountKey, string>>;

export function accountLoginUrl(key: SnapshotAccountKey, overrides: AccountLoginUrls = {}) {
  const value = overrides[key]?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? value
      : null;
  } catch {
    return null;
  }
}

export type AccountDisplayNames = Partial<Record<SnapshotAccountKey, string>>;

export function accountDisplayName(key: SnapshotAccountKey, names: AccountDisplayNames = {}) {
  return names[key]?.trim() || accountLinkAccounts.find((account) => account.key === key)?.label || key;
}
