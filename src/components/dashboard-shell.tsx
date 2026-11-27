"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { BudgetDateRangePicker } from "@/components/budget-date-range-picker";
import { BudgetLoading } from "@/components/budget-loading";
import { BudgetNavigation } from "@/components/budget-navigation";
import { LogoutButton } from "@/components/logout-button";
import { DashboardHeader } from "@/components/dashboard-header";
import { DemoBanner } from "@/components/demo-mode";
import { APP_BASE_PATH } from "@/lib/config";
import {
  budgetPlanNavigationSource,
  isBudgetPlanNavigationPending,
} from "@/lib/budget-plan-navigation";
import { isExpenseDateRange } from "@/lib/expense-date-range";

type NavigationPreferences = {
  budget_expanded?: boolean;
};

type IconProps = {
  className?: string;
};

const navigation: Array<{
  name: string;
  href: string;
  icon: (props: IconProps) => ReactNode;
  disabled?: boolean;
  parent?: string;
}> = [
  { name: "Overview", href: "/dashboard", icon: OverviewIcon },
  { name: "Accounts", href: "/dashboard/accounts", icon: AccountsIcon },
  { name: "Calendar", href: "/dashboard/calendar", icon: CalendarIcon },
  { name: "Budget", href: "/dashboard/budget", icon: BudgetIcon },
  {
    name: "Income",
    href: "/dashboard/budget/income",
    icon: IncomeIcon,
    parent: "/dashboard/budget",
  },
  {
    name: "Expenses",
    href: "/dashboard/budget/expenses",
    icon: ExpensesIcon,
    parent: "/dashboard/budget",
  },
  {
    name: "Projections",
    href: "/dashboard/budget/projections",
    icon: ProjectionsIcon,
    parent: "/dashboard/budget",
  },
  {
    name: "Goals",
    href: "/dashboard/budget/goals",
    icon: GoalsIcon,
    parent: "/dashboard/budget",
  },
  { name: "Snapshots", href: "/dashboard/snapshots", icon: SnapshotsIcon },
  { name: "Reports", href: "/dashboard/reports", icon: ReportsIcon },
  { name: "Automations", href: "/dashboard/automations", icon: AutomationsIcon },
];

const exactActiveHrefs = new Set([
  "/dashboard",
  ...navigation.flatMap((item) => (item.parent ? [item.parent] : [])),
]);
const budgetParentHref = "/dashboard/budget";
const budgetChildren = navigation.filter(
  (item) => item.parent === budgetParentHref,
);

function NavIconFrame({
  children,
  className = "size-5",
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function OverviewIcon(props: IconProps) {
  return (
    <NavIconFrame {...props}>
      <path
        d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </NavIconFrame>
  );
}

function AccountsIcon(props: IconProps) {
  return (
    <NavIconFrame {...props}>
      <path
        d="M4.5 7.5h15M6 7.5V18m4-10.5V18m4-10.5V18m4-10.5V18M5.25 18h13.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <path
        d="M12 3.75 4.75 7.5h14.5L12 3.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </NavIconFrame>
  );
}

function CalendarIcon(props: IconProps) {
  return (
    <NavIconFrame {...props}>
      <rect
        x="4.5"
        y="5.5"
        width="15"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 3.75v3.5m8-3.5v3.5M4.5 9.5h15M8 13h2m4 0h2m-8 3h2m4 0h2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </NavIconFrame>
  );
}

function BudgetIcon(props: IconProps) {
  return (
    <NavIconFrame {...props}>
      <path
        d="M5 6.75h14v10.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8 6.75V5.5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 5.5v1.25M8.5 11.25h7M8.5 14.75h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </NavIconFrame>
  );
}

function IncomeIcon(props: IconProps) {
  return (
    <NavIconFrame {...props}>
      <path
        d="M12 19V5m0 0-4 4m4-4 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M5.5 16.5v1.25A2.25 2.25 0 0 0 7.75 20h8.5a2.25 2.25 0 0 0 2.25-2.25V16.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </NavIconFrame>
  );
}

function ExpensesIcon(props: IconProps) {
  return (
    <NavIconFrame {...props}>
      <path
        d="M12 5v14m0 0-4-4m4 4 4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M5.5 7.5V6.25A2.25 2.25 0 0 1 7.75 4h8.5a2.25 2.25 0 0 1 2.25 2.25V7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </NavIconFrame>
  );
}

function ProjectionsIcon(props: IconProps) {
  return (
    <NavIconFrame {...props}>
      <path
        d="M4.5 18.5h15M6.5 16l3.5-4 3 2.5 4.5-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M15 8.5h2.5V11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </NavIconFrame>
  );
}

function GoalsIcon(props: IconProps) {
  return (
    <NavIconFrame {...props}>
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 12h7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </NavIconFrame>
  );
}

function SnapshotsIcon(props: IconProps) {
  return (
    <NavIconFrame {...props}>
      <rect
        x="4.5"
        y="6"
        width="15"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 10.5h3.25M8 13.5h6.5M15.75 10.25h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </NavIconFrame>
  );
}

function ReportsIcon(props: IconProps) {
  return (
    <NavIconFrame {...props}>
      <path
        d="M6 19V5h8.25L18 8.75V19H6Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M14 5v4h4M9 15v-2.5m3 2.5V10m3 5v-3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </NavIconFrame>
  );
}

function AutomationsIcon(props: IconProps) {
  return (
    <NavIconFrame {...props}>
      <path
        d="M5 8h9.5a3.5 3.5 0 0 1 0 7H13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <path
        d="m7.5 5.5-3 2.5 3 2.5M16.5 12.5l3 2.5-3 2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </NavIconFrame>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path
        d="M12 14.9a2.9 2.9 0 1 0 0-5.8 2.9 2.9 0 0 0 0 5.8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m13.05 3.75.45 2.05a6.48 6.48 0 0 1 1.35.56l1.77-1.13 2.15 2.15-1.13 1.77c.24.43.43.88.56 1.35l2.05.45v2.1l-2.05.45a6.48 6.48 0 0 1-.56 1.35l1.13 1.77-2.15 2.15-1.77-1.13a6.48 6.48 0 0 1-1.35.56l-.45 2.05h-2.1l-.45-2.05a6.48 6.48 0 0 1-1.35-.56l-1.77 1.13-2.15-2.15 1.13-1.77a6.48 6.48 0 0 1-.56-1.35l-2.05-.45v-2.1l2.05-.45c.13-.47.32-.92.56-1.35L5.23 7.38l2.15-2.15 1.77 1.13c.43-.24.88-.43 1.35-.56l.45-2.05h2.1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MenuIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      {isOpen ? (
        <path
          d="m6 6 12 12M18 6 6 18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      ) : (
        <path
          d="M4.5 7h15M4.5 12h15M4.5 17h15"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      )}
    </svg>
  );
}

function SettingsLink({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/");

  return (
    <Link
      aria-label="Settings"
      title="Settings"
      href="/dashboard/settings"
      onClick={onNavigate}
      className={`flex size-11 items-center justify-center rounded-xl border text-sm font-medium transition ${
        isActive
          ? "border-accent/15 bg-accent/10 text-accent"
          : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      <GearIcon />
      <span className="sr-only">Settings</span>
    </Link>
  );
}

function isNavigationItemActive(pathname: string, href: string) {
  return exactActiveHrefs.has(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function isNavigationSectionActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BudgetPlanLoadingShell() {
  return (
    <div className="w-full">
      <section className="mb-6">
        <BudgetNavigation activePathname={budgetParentHref} />
      </section>
      <BudgetDateRangePicker pathnameOverride={budgetParentHref} />
      <BudgetLoading />
    </div>
  );
}

export function DashboardShell({
  children,
  initialNavigationPreferences = {},
  isDemo = false,
}: {
  children: ReactNode;
  initialNavigationPreferences?: NavigationPreferences;
  isDemo?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const budgetRange = isExpenseDateRange({
    start: searchParams.get("start") || "",
    end: searchParams.get("end") || "",
  })
    ? {
        start: searchParams.get("start") || "",
        end: searchParams.get("end") || "",
      }
    : null;
  const isBudgetSectionActive = isNavigationSectionActive(
    pathname,
    budgetParentHref,
  );
  const [isBudgetExpanded, setIsBudgetExpanded] = useState(
    initialNavigationPreferences.budget_expanded ?? isBudgetSectionActive,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [planNavigationSourcePathname, setPlanNavigationSourcePathname] =
    useState<string | null>(null);
  const isPlanNavigationPending = isBudgetPlanNavigationPending({
    currentPathname: pathname,
    sourcePathname: planNavigationSourcePathname,
  });

  function budgetHref(href: string) {
    if (href === "/dashboard/budget/goals" || !budgetRange) return href;
    return `${href}?${new URLSearchParams(budgetRange)}`;
  }

  function setBudgetNavigationExpanded(expanded: boolean) {
    setIsBudgetExpanded(expanded);
    void fetch(`${APP_BASE_PATH}/api/budget-plan-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        navigation_preferences: { budget_expanded: expanded },
      }),
    }).catch(() => undefined);
  }

  function handleNavigationCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !(event.target instanceof Element)
    ) {
      return;
    }

    const anchor = event.target.closest("a");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
      return;
    }

    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin) return;

    setPlanNavigationSourcePathname(
      budgetPlanNavigationSource({
        appBasePath: APP_BASE_PATH,
        currentPathname: pathname,
        destinationPathname: destination.pathname,
      }),
    );
  }

  return (
    <div
      className="app-backdrop min-h-screen lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[260px_1fr] lg:overflow-hidden"
      onClickCapture={handleNavigationCapture}
    >
      <aside className="dashboard-sidebar border-b border-white/10 bg-black/15 px-5 py-5 backdrop-blur lg:fixed lg:inset-y-0 lg:w-[260px] lg:border-r lg:border-b-0 lg:px-6 lg:py-7">
        <div className="flex items-center justify-between lg:block">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-controls="dashboard-mobile-navigation"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Close navigation" : "Open navigation"}
              title={isMobileMenuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white lg:hidden"
            >
              <MenuIcon isOpen={isMobileMenuOpen} />
            </button>
            <div className="size-11 overflow-hidden rounded-2xl border border-accent/25 bg-accent/10">
              <Image
                src={`${APP_BASE_PATH}/favicon-dark.svg`}
                alt="Cookin' the Books"
                width={44}
                height={44}
                priority
                className="size-full"
              />
            </div>
            <div>
              <p className="font-semibold text-white">Cookin&apos; the Books</p>
              <p className="text-xs text-muted">Financial command center</p>
            </div>
          </div>
        </div>

        <nav
          id="dashboard-mobile-navigation"
          className={`${
            isMobileMenuOpen ? "mt-5 block space-y-2" : "hidden"
          } lg:mt-10 lg:block lg:space-y-2`}
        >
          {navigation.map((item) => {
            if (item.parent) return null;

            const Icon = item.icon;

            return item.disabled ? (
              <span
                key={item.name}
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/30"
              >
                <Icon />
                {item.name}
                <span className="ml-auto hidden text-[10px] uppercase tracking-wider lg:inline">
                  Soon
                </span>
              </span>
            ) : item.href === budgetParentHref ? (
              <div key={item.name} className="w-full lg:w-auto">
                <div className="flex items-center gap-2">
                  <Link
                    href={budgetHref(item.href)}
                    prefetch
                    onClick={() => {
                      setBudgetNavigationExpanded(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      isBudgetSectionActive
                        ? "border-accent/15 bg-accent/10 text-accent"
                        : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <Icon />
                    {item.name}
                  </Link>
                  <button
                    type="button"
                    aria-controls="budget-navigation-children"
                    aria-expanded={isBudgetExpanded}
                    aria-label={
                      isBudgetExpanded
                        ? "Collapse Budget pages"
                        : "Expand Budget pages"
                    }
                    title={
                      isBudgetExpanded
                        ? "Collapse Budget pages"
                        : "Expand Budget pages"
                    }
                    onClick={() =>
                      setBudgetNavigationExpanded(!isBudgetExpanded)
                    }
                    className={`grid size-10 shrink-0 place-items-center rounded-xl border text-sm transition ${
                      isBudgetSectionActive
                        ? "border-accent/15 bg-accent/10 text-accent"
                        : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <ChevronIcon isExpanded={isBudgetExpanded} />
                  </button>
                </div>
                <div
                  id="budget-navigation-children"
                  className={
                    isBudgetExpanded
                      ? "mt-2 space-y-2"
                      : "hidden"
                  }
                >
                  {budgetChildren.map((child) => {
                    const ChildIcon = child.icon;

                    return (
                      <Link
                        href={budgetHref(child.href)}
                        prefetch={child.href === "/dashboard/budget/income"}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition lg:ml-8 lg:w-[calc(100%-2rem)] ${
                          isNavigationItemActive(pathname, child.href)
                            ? "border-accent/15 bg-accent/10 text-accent"
                            : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                        }`}
                        key={child.name}
                      >
                        <ChildIcon />
                        {child.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div
                className={item.parent ? "lg:ml-8" : undefined}
                key={item.name}
              >
                <Link
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    isNavigationItemActive(pathname, item.href)
                      ? "border-accent/15 bg-accent/10 text-accent"
                      : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon />
                  {item.name}
                </Link>
              </div>
            );
          })}
        </nav>

        <div
          className={`${
            isMobileMenuOpen ? "mt-4 flex" : "hidden"
          } items-center gap-2 lg:hidden`}
        >
          <SettingsLink onNavigate={() => setIsMobileMenuOpen(false)} />
          <LogoutButton />
        </div>

        <div className="absolute bottom-7 left-6 hidden space-y-2 lg:block">
          <SettingsLink />
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        {isDemo ? <DemoBanner /> : null}
        <DashboardHeader
          pathnameOverride={
            isPlanNavigationPending ? budgetParentHref : undefined
          }
        />

        <main className="dashboard-content-scroll px-5 py-8 sm:px-8 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-7xl">
            {isPlanNavigationPending ? <BudgetPlanLoadingShell /> : children}
          </div>
        </main>
      </div>
    </div>
  );
}
