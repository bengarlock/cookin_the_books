import type { CreditCardTransaction } from "@/lib/credit-card-transaction-types";
import type { ExpenseAutomationCondition } from "@/lib/expense-automation-rule-types";

export function conditionIsEmpty(condition: ExpenseAutomationCondition) {
  return Array.isArray(condition.value)
    ? !condition.value.length
    : !condition.value.trim();
}

export function transactionMatchesCondition(
  transaction: CreditCardTransaction,
  condition: ExpenseAutomationCondition,
) {
  if (!["purchase", "fee", "interest"].includes(transaction.transaction_type)) return false;

  const fieldValue = condition.field === "description" ? transaction.description
    : condition.field === "issuer" ? transaction.issuer
      : condition.field === "transaction_type" ? transaction.transaction_type
        : condition.field === "account_last_four" ? transaction.account_last_four
          : condition.field === "amount" ? transaction.amount
            : condition.field === "transaction_date" ? transaction.transaction_date
              : (transaction.tags || []).map((tag) => tag.name).join(" ");

  if (condition.field === "account_last_four") {
    return Array.isArray(condition.value) && condition.value.includes(transaction.account_last_four);
  }
  const normalizeDescription = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g)
    ?.filter((token) => !["null", "none", "nan"].includes(token) && !/^x{4,}\d{0,4}$/.test(token)).join(" ") || "";
  const value = condition.field === "description" ? normalizeDescription(fieldValue) : fieldValue.toLowerCase();
  const targets = (Array.isArray(condition.value) ? condition.value : [condition.value])
    .map((item) => condition.field === "description" ? normalizeDescription(String(item)) : String(item).toLowerCase());
  const contains = (target: string) => condition.field === "description"
    ? value === target || ` ${value} `.includes(` ${target} `)
    : value.includes(target);

  if (condition.operator === "contains") return targets.some(contains);
  if (condition.operator === "not_contains") return targets.every((target) => !contains(target));
  if (condition.operator === "equals") return targets.some((target) => value === target);
  if (condition.operator === "not_equals") return targets.every((target) => value !== target);
  if (condition.operator === "starts_with") return targets.some((target) => value.startsWith(target));
  if (condition.operator === "greater_than") return Number(fieldValue) > Number(condition.value);
  if (condition.operator === "greater_than_or_equal") return Number(fieldValue) >= Number(condition.value);
  if (condition.operator === "less_than") return Number(fieldValue) < Number(condition.value);
  if (condition.operator === "less_than_or_equal") return Number(fieldValue) <= Number(condition.value);
  if (condition.operator === "on_or_after") return fieldValue >= condition.value;
  if (condition.operator === "on_or_before") return fieldValue <= condition.value;
  return false;
}

export function selectTransactions(
  transactions: CreditCardTransaction[],
  conditions: ExpenseAutomationCondition[],
  logic: "and" | "or",
) {
  if (!conditions.length || conditions.some(conditionIsEmpty)) return [];
  return transactions.filter((transaction) =>
    conditions.reduce(
      (matches, condition, index) => {
        const conditionMatches = transactionMatchesCondition(
          transaction,
          condition,
        );
        if (index === 0) return conditionMatches;
        return (condition.logic_operator || logic) === "or"
          ? matches || conditionMatches
          : matches && conditionMatches;
      },
      false,
    ),
  );
}
