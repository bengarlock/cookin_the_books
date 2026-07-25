import type { CreditCardTransaction } from "@/lib/credit-card-transaction-types";
import type { ExpenseAutomationCondition } from "@/lib/expense-automation-rule-types";
import { getCurrentPayPeriod, localPaydayString } from "./pay-cycle";

const payPeriodRangePattern = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

export function conditionIsEmpty(condition: ExpenseAutomationCondition) {
  return Array.isArray(condition.value)
    ? !condition.value.length
    : !condition.value.trim();
}

export function transactionMatchesCondition(
  transaction: CreditCardTransaction,
  condition: ExpenseAutomationCondition,
  currentDate = new Date(),
) {
  if (!["purchase", "fee", "interest"].includes(transaction.transaction_type)) return false;

  if (condition.field === "pay_period") {
    const target = Array.isArray(condition.value) ? condition.value[0] : condition.value;
    const currentPeriod = getCurrentPayPeriod(currentDate);
    const currentStart = localPaydayString(currentPeriod.start);
    const currentEnd = localPaydayString(currentPeriod.end);
    const range =
      target === "current"
        ? [currentStart, currentEnd]
        : target.match(payPeriodRangePattern)?.slice(1, 3);
    if (!range) return false;
    const matches =
      transaction.transaction_date >= range[0] &&
      transaction.transaction_date <= range[1];
    return condition.operator === "not_equals" ? !matches : matches;
  }

  if (condition.field === "transaction_status") {
    const target = Array.isArray(condition.value)
      ? condition.value[0]
      : condition.value;
    const status = transaction.pending ? "pending" : "posted";
    const matches = target === "both" || target === status;
    return condition.operator === "not_equals" ? !matches : matches;
  }

  const fieldValue = condition.field === "description" ? transaction.description
    : condition.field === "issuer" ? transaction.issuer
      : condition.field === "transaction_type" ? transaction.transaction_type
        : condition.field === "account_last_four" ? transaction.account_last_four
          : condition.field === "amount" ? transaction.amount
            : condition.field === "transaction_date" ? transaction.transaction_date
              : (transaction.tags || []).map((tag) => tag.name).join(" ");

  if (condition.field === "account_last_four") {
    const selectedAccounts = Array.isArray(condition.value) ? condition.value : [condition.value];
    return condition.operator === "not_equals"
      ? !selectedAccounts.includes(transaction.account_last_four)
      : selectedAccounts.includes(transaction.account_last_four);
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
  currentDate = new Date(),
) {
  if (!conditions.length || conditions.some(conditionIsEmpty)) return [];
  return transactions.filter((transaction) =>
    conditions.reduce(
      (matches, condition, index) => {
        const conditionMatches = transactionMatchesCondition(
          transaction,
          condition,
          currentDate,
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
