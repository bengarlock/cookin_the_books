// Marks a browser that entered through the public demo link, so an expired demo
// session signs back into the demo instead of stopping at the login form.
// It grants nothing: the backend decides who is a demo user.
export const DEMO_COOKIE_NAME = "cookinTheBooksDemo";

export const DEMO_ENTRY_PATH = "/demo";

// Fictional names for the demo account so it never shows the institutions
// behind the real account slots. Keep in sync with DEMO_ACCOUNT_LABELS in
// portfolio_database's cookin_the_books/account_identity.py.
export const DEMO_ACCOUNT_NAMES = {
  chase_checking: "Copperline Checking",
  chase_savings: "Copperline High-Yield Savings",
  chase_credit: "Copperline Rewards Visa",
  chase_credit_8506: "Copperline Cash Back Card",
  citi_current: "Larkspur Card",
  citi_pending: "Larkspur Card — Pending",
  barclays_card: "Alderpoint Travel Card",
  etrade: "Fernhill Brokerage",
  betterment_general: "Brightwater Invest — Roth IRA",
  betterment_safety: "Brightwater Invest — Emergency Fund",
  betterment_retirement: "Brightwater Invest — Retirement",
  fidelity_retirement: "Northwind 401(k)",
} as const;
