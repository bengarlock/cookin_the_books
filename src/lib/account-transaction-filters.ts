import type {
  CreditCardTransaction,
  PendingCardTransaction,
} from "./credit-card-transaction-types";
import { pendingCreditCardTransactionAmount } from "./pending-liability-transactions";
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
  transaction: Pick<
    CreditCardTransaction,
    "issuer" | "account_last_four"
  >,
) {
  const knownAccount = Object.values(transactionAccountFilters).find(
    (filters) =>
      filters?.accountLastFour === transaction.account_last_four,
  );
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
  transactions: CreditCardTransaction[],
  { spendingOnly = false }: { spendingOnly?: boolean } = {},
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
        accountSelectorLabel(transaction),
      );
    }
  });
  return Array.from(accounts, ([value, label]) => ({ value, label })).sort(
    (left, right) => left.label.localeCompare(right.label),
  );
}

export function transactionsForAccount(
  transactions: CreditCardTransaction[],
  accountKey: SnapshotAccountKey,
) {
  const filters = transactionAccountFilters[accountKey];
  if (!filters) return [];
  return transactions.filter(
    (transaction) =>
      transaction.issuer === filters.issuer &&
      transaction.account_last_four === filters.accountLastFour,
  );
}

export function accountKeyForTransaction(
  transaction: PendingCardTransaction,
): SnapshotAccountKey | null {
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
