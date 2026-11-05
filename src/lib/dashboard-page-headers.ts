export type DashboardPageHeader = {
  eyebrow: string;
  title: string;
  description: string;
};

export const dashboardPageHeaders: Record<string, DashboardPageHeader> = {
  "/dashboard": {
    eyebrow: "Overview",
    title: "Overview",
    description: "Your financial picture today.",
  },
  "/dashboard/accounts": {
    eyebrow: "Accounts",
    title: "Account balances",
    description:
      "Current cash, credit, investment, and retirement balances from the latest portfolio snapshot.",
  },
  "/dashboard/budget": {
    eyebrow: "Budget",
    title: "Pay-cycle planning",
    description:
      "Budget availability, daily spending guidance, and cash-position details calculated from live account balances.",
  },
  "/dashboard/budget/income": {
    eyebrow: "Budget",
    title: "Income",
    description:
      "Track pay statements, gross income, net income, and withholdings over time.",
  },
  "/dashboard/budget/expenses": {
    eyebrow: "Budget",
    title: "Expenses",
    description:
      "Track ongoing costs such as utilities, property taxes, insurance, and other repeating obligations.",
  },
  "/dashboard/budget/projections": {
    eyebrow: "Budget",
    title: "Projections",
    description:
      "Forecast cash position after the next pay cycle using historical income patterns and current credit-card balances.",
  },
  "/dashboard/snapshots": {
    eyebrow: "Snapshots",
    title: "Net worth history",
    description:
      "One authoritative financial position per day, with account-level detail and a permanent historical record.",
  },
  "/dashboard/automations": {
    eyebrow: "Automations",
    title: "Transaction automations",
    description:
      "Create rules that turn imported credit-card transactions into expense entries automatically.",
  },
  "/dashboard/reports": {
    eyebrow: "Reports",
    title: "Transaction reporting",
    description:
      "Build custom transaction views and compare spending, activity, and cost trends year over year.",
  },
};

const fallbackHeader: DashboardPageHeader = {
  eyebrow: "Dashboard",
  title: "Your financial tools, one workspace",
  description: "Cookin' the Books financial command center.",
};

export function getDashboardPageHeader(pathname: string) {
  return dashboardPageHeaders[pathname] || fallbackHeader;
}
