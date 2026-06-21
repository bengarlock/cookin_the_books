import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

const tools = [
  {
    name: "Account snapshots",
    description:
      "Review daily balances and compare changes across connected institutions.",
    status: "Foundation ready",
    tone: "emerald",
  },
  {
    name: "Net worth tracking",
    description:
      "Build historical trends from the portfolio database source of truth.",
    status: "Planned",
    tone: "gold",
  },
  {
    name: "Cash flow",
    description:
      "Bring income, recurring expenses, and transfer activity into one view.",
    status: "Planned",
    tone: "blue",
  },
  {
    name: "Financial automations",
    description:
      "Monitor scheduled workflows and surface actions that need attention.",
    status: "Planned",
    tone: "violet",
  },
];

const toneStyles = {
  emerald: "border-emerald-300/15 bg-emerald-300/5 text-emerald-200",
  gold: "border-amber-300/15 bg-amber-300/5 text-amber-100",
  blue: "border-sky-300/15 bg-sky-300/5 text-sky-100",
  violet: "border-violet-300/15 bg-violet-300/5 text-violet-100",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <section className="flex flex-col gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
            Overview
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Financial operations at a glance
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            This workspace will bring portfolio snapshots, trends, and
            financial utilities together around one trusted backend.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            Workspace state
          </p>
          <p className="mt-1 text-sm font-medium text-accent">
            Ready for tool integrations
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Data source", "portfolio_database"],
          ["Authentication", "Protected"],
          ["Tools online", "0"],
          ["Environment", "Configured"],
        ].map(([label, value]) => (
          <article className="surface rounded-2xl p-5" key={label}>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              {label}
            </p>
            <p className="mt-3 truncate text-xl font-semibold text-white">
              {value}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
              Tool registry
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Financial tools
            </h2>
          </div>
          <p className="hidden text-sm text-muted sm:block">
            Modules will appear here as they are connected.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {tools.map((tool) => (
            <article
              className="surface group rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-white/20"
              key={tool.name}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg text-white/70">
                  $
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    toneStyles[tool.tone as keyof typeof toneStyles]
                  }`}
                >
                  {tool.status}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-white">
                {tool.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                {tool.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
