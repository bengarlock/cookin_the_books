import type {
  CreditCardTransaction,
  PendingCardTransaction,
} from "./credit-card-transaction-types";
import { pendingCreditCardTransactionAmount } from "./pending-liability-transactions";
import type { AccountDisplayNames } from "./account-links";
import type { SnapshotAccountKey } from "./snapshot-types";

export const transactionAccountFilters: Partial<
  Record<
    SnapshotAccountKey,
    {
      issuer: string;
      accountLastFour: string;
      selectorLabel: string;
      includeUnbudgeted?: boolean;
    }
  >
> = {
  chase_checking: {
    issuer: "Chase",
    accountLastFour: "0277",
    selectorLabel: "Chase Checking",
    includeUnbudgeted: true,
  },
  chase_savings: {
    issuer: "Chase",
    accountLastFour: "3060",
    selectorLabel: "Chase Savings",
    includeUnbudgeted: true,
  },
  chase_credit: {
    issuer: "Chase",
    accountLastFour: "9125",
    selectorLabel: "Chase Mastercard · Credit card",
    includeUnbudgeted: true,
  },
  chase_credit_8506: {
    issuer: "Chase",
    accountLastFour: "8506",
    selectorLabel: "Chase Credit Card · Credit card",
    includeUnbudgeted: true,
  },
  citi_current: {
    issuer: "Citibank Online",
    accountLastFour: "4596",
    selectorLabel: "Citi Card · Credit card",
    includeUnbudgeted: true,
  },
  barclays_card: {
    issuer: "Barclays - Cards",
    accountLastFour: "2028",
    selectorLabel: "Barclaycard · Credit card",
    includeUnbudgeted: true,
  },
};

export function accountSelectorLabel(
  transaction: Pick<CreditCardTransaction, "issuer" | "account_last_four"> & {
    account_key?: CreditCardTransaction["account_key"];
  },
  names: AccountDisplayNames = {},
) {
  const accountKey =
    transaction.account_key ||
    (Object.entries(transactionAccountFilters).find(
      ([, filters]) => filters?.accountLastFour === transaction.account_last_four,
    )?.[0] as SnapshotAccountKey | undefined);
  const knownAccount = accountKey ? transactionAccountFilters[accountKey] : undefined;
  const customName = accountKey ? names[accountKey]?.trim() : "";
  if (customName) {
    const kind = knownAccount?.selectorLabel.includes(" · Credit card") ? " · Credit card" : "";
    return `${customName}${kind} •••• ${transaction.account_last_four}`;
  }
  const fallbackIssuer = transaction.issuer
    .replace(/\s*-\s*Cards$/i, "")
    .replace(/\s+Online$/i, "")
    .trim();
  const accountName =
    knownAccount?.selectorLabel ||
    `${fallbackIssuer || "Unknown account"} · Credit card`;
  return `${accountName} •••• ${transaction.account_last_four}`;
}

export function accountSelectorOptions(
  transactions: (Pick<
    CreditCardTransaction,
    "issuer" | "account_last_four" | "transaction_type"
  > & { account_key?: CreditCardTransaction["account_key"] })[],
  {
    spendingOnly = false,
    names = {},
  }: { spendingOnly?: boolean; names?: AccountDisplayNames } = {},
) {
  const accounts = new Map<string, string>();
  transactions.forEach((transaction) => {
    if (
      /^\d{4}$/.test(transaction.account_last_four) &&
      (!spendingOnly ||
        ["purchase", "fee", "interest"].includes(transaction.transaction_type))
    ) {
      accounts.set(
        transaction.account_last_four,
        accountSelectorLabel(transaction, names),
      );
    }
  });
  return Array.from(accounts, ([value, label]) => ({ value, label })).sort(
    (left, right) => left.label.localeCompare(right.label),
  );
}

export function transactionsForAccount<T extends Pick<
  CreditCardTransaction,
  "issuer" | "account_last_four" | "account_key"
>>(
  transactions: T[],
  accountKey: SnapshotAccountKey,
): T[] {
  const filters = transactionAccountFilters[accountKey];
  if (!filters) return [];
  return transactions.filter(
    (transaction) =>
      transaction.account_key === accountKey ||
      (!transaction.account_key &&
        transaction.issuer === filters.issuer &&
        transaction.account_last_four === filters.accountLastFour),
  );
}

export function accountKeyForTransaction(
  transaction: PendingCardTransaction,
): SnapshotAccountKey | null {
  if (transaction.account_key) return transaction.account_key;
  for (const [accountKey, filters] of Object.entries(transactionAccountFilters)) {
    if (
      filters &&
      transaction.issuer === filters.issuer &&
      transaction.account_last_four === filters.accountLastFour
    ) {
      return accountKey as SnapshotAccountKey;
    }
  }
  return null;
}

export type LoadedAccountTransactions = Partial<
  Record<
    SnapshotAccountKey,
    {
      isLoading: boolean;
      error: string;
      transactions: PendingCardTransaction[];
    }
  >
>;

export function importedPendingLiabilityTotals({
  summaryTransactions,
  loadedTransactions,
}: {
  summaryTransactions: PendingCardTransaction[];
  loadedTransactions?: LoadedAccountTransactions;
}) {
  const totals = new Map<SnapshotAccountKey, number>();
  const loadedAccountKeys = new Set<SnapshotAccountKey>();

  if (loadedTransactions) {
    for (const [accountKey, state] of Object.entries(loadedTransactions)) {
      if (!state || state.isLoading || state.error) continue;
      const typedAccountKey = accountKey as SnapshotAccountKey;
      loadedAccountKeys.add(typedAccountKey);
      for (const transaction of state.transactions) {
        const amount = pendingCreditCardTransactionAmount(transaction);
        if (!amount) continue;
        totals.set(typedAccountKey, (totals.get(typedAccountKey) || 0) + amount);
      }
    }
  }

  for (const transaction of summaryTransactions) {
    const accountKey = accountKeyForTransaction(transaction);
    if (!accountKey || loadedAccountKeys.has(accountKey)) continue;
    const amount = pendingCreditCardTransactionAmount(transaction);
    if (!amount) continue;
    totals.set(accountKey, (totals.get(accountKey) || 0) + amount);
  }

  return totals;
}
