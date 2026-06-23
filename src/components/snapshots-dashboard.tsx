"use client";

import {
  FormEvent,
  type MouseEvent as ReactMouseEvent,
  useMemo,
  useState,
} from "react";

import { DateRangePicker } from "@/components/date-range-picker";
import { APP_BASE_PATH } from "@/lib/config";
import {
  defaultExpenseDateRange,
  type ExpenseDateRange,
} from "@/lib/expense-date-range";
import type {
  BankValueSnapshot,
  SnapshotAccountBalance,
  SnapshotAccountKey,
} from "@/lib/snapshot-types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});
const shortDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const accountDefinitions: Array<{
  key: SnapshotAccountKey;
  label: string;
  liability?: boolean;
}> = [
  { key: "chase_checking", label: "Chase Checking" },
  { key: "chase_savings", label: "Chase Savings" },
  { key: "chase_credit", label: "Chase Mastercard", liability: true },
  { key: "citi_current", label: "Citi Card - Current", liability: true },
  { key: "citi_pending", label: "Citi Card - Pending", liability: true },
  { key: "barclays_card", label: "Barclaycard", liability: true },
  { key: "etrade", label: "E*TRADE" },
  { key: "betterment_general", label: "Betterment - General" },
  { key: "betterment_safety", label: "Betterment - Safety Net" },
  { key: "betterment_retirement", label: "Betterment - Retirement" },
  { key: "fidelity_retirement", label: "Fidelity 401(k)" },
];

type BalanceForm = Record<SnapshotAccountKey, string>;

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00`));
}

function localToday() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function balancesFromSnapshot(
  snapshot: BankValueSnapshot | undefined,
): BalanceForm {
  return Object.fromEntries(
    accountDefinitions.map(({ key }) => [
      key,
      snapshot?.[key] || "0.00",
    ]),
  ) as BalanceForm;
}

function Metric({
  label,
  value,
  featured = false,
  negative = false,
}: {
  label: string;
  value: string;
  featured?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        featured
          ? "border-accent/25 bg-accent/[0.09]"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <p
        className={`mt-3 font-mono text-2xl font-semibold ${
          negative ? "text-rose-300" : featured ? "text-accent" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SnapshotTrendChart({
  snapshots,
  showTrendLine,
}: {
  snapshots: BankValueSnapshot[];
  showTrendLine: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chart = useMemo(() => {
    const data = [...snapshots].reverse();
    if (!data.length) return null;
    const width = 960;
    const height = 360;
    const padding = { top: 28, right: 26, bottom: 54, left: 82 };
    const values = data.map((item) => Number(item.net_assets));
    const rawMinValue = Math.min(...values);
    const rawMaxValue = Math.max(...values);
    const rawRange = Math.max(rawMaxValue - rawMinValue, 1);
    const scalePadding = rawRange * 0.08;
    const minValue = rawMinValue - scalePadding;
    const maxValue = rawMaxValue + scalePadding;
    const range = maxValue - minValue;
    const x = (index: number) =>
      padding.left +
      (index / Math.max(data.length - 1, 1)) *
        (width - padding.left - padding.right);
    const y = (value: number) =>
      padding.top +
      ((maxValue - value) / range) *
        (height - padding.top - padding.bottom);
    const points = data
      .map((item, index) => `${x(index)},${y(Number(item.net_assets))}`)
      .join(" ");

    const count = data.length;
    const meanX = (count - 1) / 2;
    const meanY = values.reduce((sum, value) => sum + value, 0) / count;
    const slopeNumerator = values.reduce(
      (sum, value, index) => sum + (index - meanX) * (value - meanY),
      0,
    );
    const slopeDenominator = values.reduce(
      (sum, _value, index) => sum + (index - meanX) ** 2,
      0,
    );
    const slope = slopeDenominator ? slopeNumerator / slopeDenominator : 0;
    const trendStart = meanY - slope * meanX;
    const trendEnd = meanY + slope * (count - 1 - meanX);
    const tickCount = Math.min(5, data.length);
    const xTickIndexes = Array.from(
      { length: tickCount },
      (_, index) =>
        Math.round(
          (index / Math.max(tickCount - 1, 1)) * (data.length - 1),
        ),
    );
    const firstDate = new Date(`${data[0].snapshot_date}T12:00:00`);
    const lastDate = new Date(
      `${data[data.length - 1].snapshot_date}T12:00:00`,
    );
    const dateSpanDays =
      Math.abs(lastDate.getTime() - firstDate.getTime()) / 86_400_000;

    return {
      data,
      width,
      height,
      padding,
      minValue,
      maxValue,
      x,
      y,
      points,
      trendPoints: `${x(0)},${y(trendStart)} ${x(count - 1)},${y(trendEnd)}`,
      xTickIndexes,
      dateSpanDays,
    };
  }, [snapshots]);

  if (!chart) {
    return (
      <div className="grid h-72 place-items-center text-sm text-muted">
        No snapshots fall within the selected date range.
      </div>
    );
  }

  const activeChart = chart;
  const hoveredSnapshot =
    hoveredIndex === null ? null : activeChart.data[hoveredIndex] || null;
  const hoveredX =
    hoveredIndex === null ? null : activeChart.x(hoveredIndex);
  const hoveredY = hoveredSnapshot
    ? activeChart.y(Number(hoveredSnapshot.net_assets))
    : null;
  const tooltipWidth = 196;
  const tooltipHeight = 68;
  const tooltipX =
    hoveredX === null
      ? 0
      : hoveredX + tooltipWidth + 18 >
          activeChart.width - activeChart.padding.right
        ? hoveredX - tooltipWidth - 14
        : hoveredX + 14;
  const tooltipY =
    hoveredY === null
      ? 0
      : Math.min(
          Math.max(
            hoveredY - tooltipHeight / 2,
            activeChart.padding.top,
          ),
          activeChart.height -
            activeChart.padding.bottom -
            tooltipHeight,
        );

  function handleChartHover(event: ReactMouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX =
      ((event.clientX - bounds.left) / bounds.width) * activeChart.width;
    const plotStart = activeChart.padding.left;
    const plotEnd = activeChart.width - activeChart.padding.right;

    if (pointerX < plotStart || pointerX > plotEnd) {
      setHoveredIndex(null);
      return;
    }

    const plotProgress = (pointerX - plotStart) / (plotEnd - plotStart);
    setHoveredIndex(
      Math.round(
        plotProgress * Math.max(activeChart.data.length - 1, 0),
      ),
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg
        aria-label="Net assets over time"
        className="min-w-[680px] cursor-crosshair"
        onMouseLeave={() => setHoveredIndex(null)}
        onMouseMove={handleChartHover}
        role="img"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((position) => {
          const value =
            chart.maxValue - (chart.maxValue - chart.minValue) * position;
          const y = chart.y(value);
          return (
            <g key={position}>
              <line
                stroke="rgba(255,255,255,0.08)"
                x1={chart.padding.left}
                x2={chart.width - chart.padding.right}
                y1={y}
                y2={y}
              />
              <text
                fill="rgba(255,255,255,0.42)"
                fontSize="11"
                textAnchor="end"
                x={chart.padding.left - 12}
                y={y + 4}
              >
                {compactCurrencyFormatter.format(value)}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="snapshot-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#56e2aa" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#56e2aa" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <polygon
          fill="url(#snapshot-area)"
          points={`${chart.padding.left},${
            chart.height - chart.padding.bottom
          } ${chart.points} ${chart.width - chart.padding.right},${
            chart.height - chart.padding.bottom
          }`}
        />
        {showTrendLine ? (
          <polyline
            fill="none"
            points={chart.trendPoints}
            stroke="rgba(240,201,120,0.72)"
            strokeDasharray="9 8"
            strokeWidth="2.5"
          />
        ) : null}
        <polyline
          fill="none"
          points={chart.points}
          stroke="#56e2aa"
          strokeLinejoin="round"
          strokeWidth="2.75"
        />
        {chart.data.map((snapshot, index) => {
          const showPoint =
            chart.data.length <= 120 ||
            snapshot.is_highpoint ||
            index === chart.data.length - 1;
          if (!showPoint) return null;
          return (
            <circle
              fill={
                snapshot.is_highpoint
                  ? "#f0c978"
                  : Number(snapshot.change) < 0
                    ? "#fda4af"
                    : "#56e2aa"
              }
              key={snapshot.id}
              r={snapshot.is_highpoint ? 3.8 : 2.6}
              stroke="#07100f"
              strokeWidth="1.2"
              cx={chart.x(index)}
              cy={chart.y(Number(snapshot.net_assets))}
            >
              <title>
                {formatDate(snapshot.snapshot_date)}:{" "}
                {currencyFormatter.format(Number(snapshot.net_assets))} (
                {currencyFormatter.format(Number(snapshot.change))})
                {snapshot.is_highpoint ? " · Highpoint" : ""}
              </title>
            </circle>
          );
        })}
        {chart.xTickIndexes.map((index) => {
          const snapshot = chart.data[index];
          return (
            <text
              fill="rgba(255,255,255,0.46)"
              fontSize="11"
              key={snapshot.id}
              textAnchor={
                index === 0
                  ? "start"
                  : index === chart.data.length - 1
                    ? "end"
                    : "middle"
              }
              x={chart.x(index)}
              y={chart.height - 17}
            >
              {(chart.dateSpanDays <= 400
                ? shortDayFormatter
                : shortDateFormatter
              ).format(new Date(`${snapshot.snapshot_date}T12:00:00`))}
            </text>
          );
        })}
        {hoveredSnapshot && hoveredX !== null && hoveredY !== null ? (
          <g aria-hidden="true" pointerEvents="none">
            <line
              stroke="rgba(255,255,255,0.3)"
              strokeDasharray="4 5"
              strokeWidth="1"
              x1={hoveredX}
              x2={hoveredX}
              y1={chart.padding.top}
              y2={chart.height - chart.padding.bottom}
            />
            <circle
              cx={hoveredX}
              cy={hoveredY}
              fill="#07100f"
              r="6"
              stroke="#56e2aa"
              strokeWidth="3"
            />
            <rect
              fill="#0b1714"
              height={tooltipHeight}
              rx="10"
              stroke="rgba(86,226,170,0.35)"
              width={tooltipWidth}
              x={tooltipX}
              y={tooltipY}
            />
            <text
              fill="rgba(255,255,255,0.6)"
              fontSize="11"
              x={tooltipX + 13}
              y={tooltipY + 20}
            >
              {formatDate(hoveredSnapshot.snapshot_date)}
            </text>
            <text
              fill="#ffffff"
              fontFamily="monospace"
              fontSize="15"
              fontWeight="600"
              x={tooltipX + 13}
              y={tooltipY + 42}
            >
              {currencyFormatter.format(
                Number(hoveredSnapshot.net_assets),
              )}
            </text>
            <text
              fill={
                Number(hoveredSnapshot.change) < 0
                  ? "#fda4af"
                  : "#56e2aa"
              }
              fontFamily="monospace"
              fontSize="11"
              x={tooltipX + 13}
              y={tooltipY + 58}
            >
              Daily:{" "}
              {currencyFormatter.format(Number(hoveredSnapshot.change))}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

export function SnapshotsDashboard({
  initialSnapshots,
}: {
  initialSnapshots: BankValueSnapshot[];
}) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [chartRange, setChartRange] = useState<ExpenseDateRange>(() =>
    defaultExpenseDateRange(),
  );
  const [showTrendLine, setShowTrendLine] = useState(true);
  const todaySnapshot = snapshots.find(
    (snapshot) => snapshot.snapshot_date === localToday(),
  );
  const latestSnapshot = snapshots[0];
  const [selectedId, setSelectedId] = useState<number | null>(
    latestSnapshot?.id || null,
  );
  const [isCreating, setIsCreating] = useState(!todaySnapshot);
  const selectedSnapshot =
    snapshots.find((snapshot) => snapshot.id === selectedId) || latestSnapshot;
  const editorBase = isCreating ? latestSnapshot : todaySnapshot;
  const [notes, setNotes] = useState(editorBase?.notes || "");
  const [balanceForm, setBalanceForm] = useState<BalanceForm>(
    balancesFromSnapshot(editorBase),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function openEditor(snapshot?: BankValueSnapshot) {
    const target = snapshot || latestSnapshot;
    setIsCreating(!snapshot);
    setSelectedId(snapshot?.id || null);
    setNotes(snapshot?.notes || "");
    setBalanceForm(balancesFromSnapshot(target));
    setError("");
    setMessage("");
  }

  function selectSnapshot(snapshot: BankValueSnapshot) {
    setSelectedId(snapshot.id);
    setIsCreating(false);
    setNotes(snapshot.notes);
    setBalanceForm(balancesFromSnapshot(snapshot));
    setError("");
    setMessage("");
  }

  async function saveToday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setMessage("");

    const accountBalances = accountDefinitions.map(({ key }) => ({
      account_key: key,
      balance: balanceForm[key] || "0",
    }));
    const payload = isCreating
      ? {
          ...balanceForm,
          notes,
          source_updated_at: new Date().toISOString(),
        }
      : { notes, account_balances: accountBalances };

    try {
      const response = await fetch(
        isCreating
          ? `${APP_BASE_PATH}/api/snapshots`
          : `${APP_BASE_PATH}/api/snapshots/${todaySnapshot?.id}`,
        {
          method: isCreating ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | BankValueSnapshot
        | { detail?: string; message?: string }
        | null;
      if (!response.ok || !result || !("id" in result)) {
        throw new Error(
          result && "detail" in result && result.detail
            ? result.detail
            : result && "message" in result && result.message
              ? result.message
              : "Unable to save today's snapshot.",
        );
      }
      setSnapshots((current) => {
        const withoutSaved = current.filter((item) => item.id !== result.id);
        return [result, ...withoutSaved].sort((left, right) =>
          right.snapshot_date.localeCompare(left.snapshot_date),
        );
      });
      setSelectedId(result.id);
      setIsCreating(false);
      setNotes(result.notes);
      setBalanceForm(balancesFromSnapshot(result));
      setMessage("Today's snapshot was saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save today's snapshot.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const current = snapshots[0];
  const firstSnapshotDate = snapshots.reduce<string | undefined>(
    (earliest, snapshot) =>
      !earliest || snapshot.snapshot_date < earliest
        ? snapshot.snapshot_date
        : earliest,
    undefined,
  );
  const summaryChange = Number(current?.change || 0);
  const chartSnapshots = useMemo(
    () =>
      snapshots.filter(
        (snapshot) =>
          snapshot.snapshot_date >= chartRange.start &&
          snapshot.snapshot_date <= chartRange.end,
      ),
    [chartRange, snapshots],
  );
  const chartRangeChange = useMemo(() => {
    if (chartSnapshots.length < 2) {
      return { amount: 0, percentage: 0 };
    }
    const chronological = [...chartSnapshots].sort((left, right) =>
      left.snapshot_date.localeCompare(right.snapshot_date),
    );
    const firstValue = Number(chronological[0].net_assets);
    const lastValue = Number(
      chronological[chronological.length - 1].net_assets,
    );
    const amount = lastValue - firstValue;
    return {
      amount,
      percentage: firstValue ? (amount / firstValue) * 100 : 0,
    };
  }, [chartSnapshots]);
  const chartRangeChangeLabel =
    chartRangeChange.amount < 0
      ? "Range loss"
      : chartRangeChange.amount > 0
        ? "Range gain"
        : "Range change";

  return (
    <div className="mt-8 space-y-6">
      {error ? (
        <p
          className="rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric
          featured
          label="Current net assets"
          negative={Number(current?.net_assets || 0) < 0}
          value={currencyFormatter.format(Number(current?.net_assets || 0))}
        />
        <Metric
          label="Daily change"
          negative={summaryChange < 0}
          value={currencyFormatter.format(summaryChange)}
        />
        <Metric
          label="Percentage change"
          negative={Number(current?.change_percentage || 0) < 0}
          value={`${Number(current?.change_percentage || 0).toFixed(2)}%`}
        />
        <Metric
          label="Highpoint watermark"
          value={currencyFormatter.format(
            Number(current?.last_highpoint_net_assets || 0),
          )}
        />
        <Metric
          label="Loss since highpoint"
          negative={Number(current?.loss_since_highpoint || 0) > 0}
          value={`${currencyFormatter.format(
            Number(current?.loss_since_highpoint || 0),
          )} (${Number(
            current?.loss_since_highpoint_percentage || 0,
          ).toFixed(2)}%)`}
        />
        <Metric
          label="Snapshot date"
          value={current ? formatDate(current.snapshot_date) : "No snapshot"}
        />
      </section>

      <section className="surface overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.035] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Net assets trend
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                chartRangeChange.amount < 0
                  ? "border-rose-300/20 bg-rose-500/10 text-rose-300"
                  : "border-accent/20 bg-accent/10 text-accent"
              }`}
            >
              {chartRangeChangeLabel}:{" "}
              <span className="font-mono">
                {currencyFormatter.format(
                  Math.abs(chartRangeChange.amount),
                )}{" "}
                ({Math.abs(chartRangeChange.percentage).toFixed(2)}%)
              </span>
            </div>
            <DateRangePicker
              allTimeStart={firstSnapshotDate}
              dialogLabel="Select snapshot date range"
              onApply={setChartRange}
              range={chartRange}
            />
            <button
              aria-pressed={showTrendLine}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                showTrendLine
                  ? "border-gold/30 bg-gold/10 text-gold"
                  : "border-white/10 bg-black/15 text-white/55 hover:text-white/75"
              }`}
              onClick={() => setShowTrendLine((currentValue) => !currentValue)}
              type="button"
            >
              Trend line {showTrendLine ? "on" : "off"}
            </button>
            {!todaySnapshot ? (
              <button
                className="rounded-xl bg-accent-strong px-4 py-2.5 text-sm font-semibold text-[#03120c] hover:bg-accent"
                onClick={() => openEditor()}
                type="button"
              >
                Create today&apos;s snapshot
              </button>
            ) : null}
          </div>
        </div>
        <div className="p-3 sm:p-5">
          <SnapshotTrendChart
            showTrendLine={showTrendLine}
            snapshots={chartSnapshots}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <section className="surface overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 bg-white/[0.035] px-5 py-4">
            <h2 className="text-base font-semibold text-white">
              Snapshot history
            </h2>
            <p className="mt-1 text-xs text-muted">
              Newest records appear first. Historical records are permanent.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.13em] text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Net assets
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">Change</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Highpoint
                  </th>
                  <th className="px-5 py-3 font-semibold">Notes</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr
                    className={`cursor-pointer border-b border-white/[0.07] transition hover:bg-white/[0.035] ${
                      snapshot.id === selectedSnapshot?.id
                        ? "bg-accent/[0.06]"
                        : ""
                    }`}
                    key={snapshot.id}
                    onClick={() => selectSnapshot(snapshot)}
                  >
                    <td className="px-5 py-3.5 text-sm text-white/80">
                      {formatDate(snapshot.snapshot_date)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-sm font-semibold text-white">
                      {currencyFormatter.format(Number(snapshot.net_assets))}
                    </td>
                    <td
                      className={`px-5 py-3.5 text-right font-mono text-sm ${
                        Number(snapshot.change) < 0
                          ? "text-rose-300"
                          : "text-accent"
                      }`}
                    >
                      {currencyFormatter.format(Number(snapshot.change))}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {snapshot.is_highpoint ? (
                        <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-gold">
                          Highpoint
                        </span>
                      ) : (
                        <span className="font-mono text-sm text-rose-300">
                          -
                          {currencyFormatter.format(
                            Number(snapshot.loss_since_highpoint),
                          )}
                        </span>
                      )}
                    </td>
                    <td className="max-w-64 truncate px-5 py-3.5 text-sm text-muted">
                      {snapshot.notes || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                          snapshot.is_editable
                            ? "border-accent/20 bg-accent/10 text-accent"
                            : "border-white/10 bg-white/[0.04] text-white/45"
                        }`}
                      >
                        {snapshot.is_editable ? "Editable" : "Locked"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!snapshots.length ? (
              <p className="px-5 py-10 text-center text-sm text-muted">
                No snapshots have been recorded yet.
              </p>
            ) : null}
          </div>
        </section>

        <section className="surface overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 bg-white/[0.035] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {isCreating
                    ? "Create today's snapshot"
                    : selectedSnapshot
                      ? formatDate(selectedSnapshot.snapshot_date)
                      : "Snapshot detail"}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {isCreating || selectedSnapshot?.is_editable
                    ? "Account balances and notes can be updated today."
                    : "Historical record · locked"}
                </p>
              </div>
              {!isCreating && selectedSnapshot ? (
                <div className="flex flex-wrap justify-end gap-2">
                  {selectedSnapshot.is_highpoint ? (
                    <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-gold">
                      Highpoint
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                      selectedSnapshot.is_editable
                        ? "border-accent/20 bg-accent/10 text-accent"
                        : "border-white/10 bg-white/[0.04] text-white/45"
                    }`}
                  >
                    {selectedSnapshot.is_editable ? "Editable" : "Locked"}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {isCreating || selectedSnapshot?.is_editable ? (
            <form className="space-y-5 p-5" onSubmit={saveToday}>
              <div className="grid gap-3 sm:grid-cols-2">
                {accountDefinitions.map((account) => (
                  <label key={account.key}>
                    <span className="mb-1.5 block text-xs text-muted">
                      {account.label}
                      {account.liability ? " (liability)" : ""}
                    </span>
                    <input
                      autoComplete="off"
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-right font-mono text-sm text-white outline-none focus:border-accent/50"
                      data-1p-ignore
                      data-op-ignore
                      inputMode="decimal"
                      onChange={(event) =>
                        setBalanceForm((currentForm) => ({
                          ...currentForm,
                          [account.key]: event.target.value,
                        }))
                      }
                      type="text"
                      value={balanceForm[account.key]}
                    />
                  </label>
                ))}
              </div>
              <label>
                <span className="mb-1.5 block text-xs text-muted">Notes</span>
                <textarea
                  className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-accent/50"
                  maxLength={2000}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Record a significant financial event…"
                  value={notes}
                />
              </label>
              <button
                className="w-full rounded-xl bg-accent-strong px-4 py-2.5 text-sm font-semibold text-[#03120c] hover:bg-accent disabled:opacity-50"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Saving…" : "Save today's snapshot"}
              </button>
            </form>
          ) : selectedSnapshot ? (
            <div>
              <div className="grid grid-cols-2 border-b border-white/[0.07] bg-black/10">
                <div className="border-r border-white/[0.07] px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-muted">
                    Net assets
                  </p>
                  <p className="mt-2 font-mono text-lg font-semibold text-white">
                    {currencyFormatter.format(
                      Number(selectedSnapshot.net_assets),
                    )}
                  </p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-muted">
                    Daily change
                  </p>
                  <p
                    className={`mt-2 font-mono text-lg font-semibold ${
                      Number(selectedSnapshot.change) < 0
                        ? "text-rose-300"
                        : "text-accent"
                    }`}
                  >
                    {currencyFormatter.format(Number(selectedSnapshot.change))}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 border-b border-white/[0.07] bg-black/10">
                <div className="border-r border-white/[0.07] px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-muted">
                    Last highpoint
                  </p>
                  <p className="mt-2 font-mono text-lg font-semibold text-gold">
                    {currencyFormatter.format(
                      Number(selectedSnapshot.last_highpoint_net_assets),
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatDate(selectedSnapshot.last_highpoint_date)}
                  </p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-muted">
                    Loss since highpoint
                  </p>
                  <p
                    className={`mt-2 font-mono text-lg font-semibold ${
                      Number(selectedSnapshot.loss_since_highpoint) > 0
                        ? "text-rose-300"
                        : "text-accent"
                    }`}
                  >
                    {currencyFormatter.format(
                      Number(selectedSnapshot.loss_since_highpoint),
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {Number(
                      selectedSnapshot.loss_since_highpoint_percentage,
                    ).toFixed(2)}
                    % below watermark
                  </p>
                </div>
              </div>
              {selectedSnapshot.notes ? (
                <div className="border-b border-white/[0.07] px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-muted">
                    Notes
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/75">
                    {selectedSnapshot.notes}
                  </p>
                </div>
              ) : null}
              <div>
                <div className="border-b border-white/[0.07] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted">
                  Account balance breakdown
                </div>
                {selectedSnapshot.account_balances.map(
                  (balance: SnapshotAccountBalance) => (
                    <div
                      className="flex items-center justify-between gap-5 border-b border-white/[0.07] px-5 py-3 last:border-b-0"
                      key={balance.id}
                    >
                      <span className="text-sm text-white/70">
                        {balance.account_name}
                      </span>
                      <span className="font-mono text-sm font-semibold text-white">
                        {currencyFormatter.format(Number(balance.balance))}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted">
              Select a snapshot to view its detail.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
