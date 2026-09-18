/** The API stores debits as positive amounts and credits as negative amounts. */
export function pendingTransactionAmount(amount: string, direction: "debit" | "credit") {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0.01) {
    throw new Error("Enter a positive amount of at least 0.01.");
  }
  return (direction === "credit" ? -value : value).toFixed(2);
}
