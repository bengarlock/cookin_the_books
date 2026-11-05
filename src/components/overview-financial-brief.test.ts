import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OverviewFinancialBrief, overviewCurrency } from "./overview-financial-brief";
import type { FinancialGoal } from "../lib/financial-goal-types";
import type { BankValueSnapshot } from "../lib/snapshot-types";

const snapshot = { citi_current: "400", citi_pending: "0", chase_savings: "300", change: "30.63" } as BankValueSnapshot;
const context = { snapshot, currentDate: new Date(2026, 10, 5, 12), pendingTransactions: [], pendingCardTransactions: [], transactions: [], projectedNextPaycheck: 2000 };
const goal: FinancialGoal = {
  id: 1, goal_type: "flexible", name: "Pay cycle spending cap", target_amount: null,
  period_mode: null, pay_cycle_start: null, pay_cycle_end: null,
  scope_conditions: [{ id: "account", field: "account_last_four", operator: "equals", value: ["4596"] }],
  success_conditions: [{ id: "cap", field: "current_balances", operator: "less_than_or_equal", value: "1600" }, { id: "period", field: "spending_period", operator: "within", value: "2026-10-30..2026-11-13" }],
  tracking_metrics: ["remaining_budget", "daily_spending_limit", "total_budget", "days_left_in_pay_cycle", "projected_savings", "total_credit_card_spend"],
  pinned_tracking_metrics: ["remaining_budget", "daily_spending_limit", "total_budget", "days_left_in_pay_cycle", "projected_savings", "total_credit_card_spend"],
  is_active: true, is_pinned: true, created_at: "", updated_at: "",
};

function render(goals: FinancialGoal[] = [goal], overrides = {}) {
  return renderToStaticMarkup(createElement(OverviewFinancialBrief, { context, goals, grossAssets: 501885.96, netAssets: 501354.55, ...overrides }));
}

describe("Overview financial brief", () => {
  it("puts attention before the asset summary and keeps balance sheet precision", () => {
    const html = render([], { attention: createElement("p", null, "Reserve shortfall"), attentionCount: 1 });
    expect(html.indexOf("Reserve shortfall")).toBeLessThan(html.indexOf("Asset summary"));
    expect(html).toContain(">$501,355</p>");
    expect(html).toContain(">$501,354.55</dd>");
    expect(html).toContain(">-$531.41</dd>");
    expect(html).toContain("Choose goals");
  });

  it("groups pinned metrics once per goal using the existing evaluated values", () => {
    const html = render();
    expect((html.match(/<article /g) || []).length).toBe(1);
    expect(html).toContain("$1,200.00");
    expect(html).toContain("$150.00");
    expect(html).toContain("8 days");
    expect(html).toContain("$400.00");
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain("Projected savings");
    expect(html).not.toContain("Total credit card spend</dt>");
    expect(html).not.toContain("Total budget</dt>");
  });

  it("includes metric-only pins but omits unpinned goals and stale tracking pins", () => {
    expect(render([{ ...goal, is_pinned: false }])).toContain("Pay cycle spending cap");
    const html = render([{ ...goal, is_pinned: false, tracking_metrics: [], pinned_tracking_metrics: ["remaining_budget"] }]);
    expect(html).not.toContain("Pay cycle spending cap");
    expect(html).not.toContain("Needs attention");
  });

  it("labels a minimum cash balance as a threshold gap, without a spending progress bar", () => {
    const cash = { ...goal, name: "Total Cash", success_conditions: [{ id: "cash", field: "account_balance" as const, operator: "greater_than" as const, value: "500" }], scope_conditions: [{ id: "account", field: "account_last_four" as const, operator: "equals" as const, value: ["3060"] }], tracking_metrics: ["remaining_budget" as const], pinned_tracking_metrics: ["remaining_budget" as const] };
    const html = render([cash]);
    expect(html).toContain("Gap to threshold");
    expect(html).toContain("$200.00");
    expect(html).not.toContain('role="progressbar"');
  });

  it("does not fabricate balances or a successful goal state before a snapshot arrives", () => {
    const html = render([goal], { context: { ...context, snapshot: null } });
    expect(html).toContain("Awaiting snapshot");
    expect(html).not.toContain("Conditions met");
    expect(html).not.toContain("$501,355");
    expect(html).not.toContain('role="progressbar"');
    expect(overviewCurrency(null)).toBe("—");
    expect(overviewCurrency(Number.NaN)).toBe("—");
  });
});
