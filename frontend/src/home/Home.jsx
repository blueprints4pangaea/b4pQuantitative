// Home: the few numbers people check most, from each area, plus two charts:
// value of supplies donated year over year, and net finances over time.
import { useMemo, useState } from "react";
import { useApi } from "../shared/api";
import { BarChart, useWidth } from "../shared/charts";
import { HQ } from "../shared/chapters";
import { describeFilters, matchChapters, useFinance, useScores, useShipments } from "../shared/data";
import { formatMonth, formatNum, formatPct, formatUsd, formatUsdShort } from "../shared/format";
import { sortSemesters } from "../shared/semester";
import { summarize } from "../expansion/scoreStats";
import { filterFinance, financeTotals } from "../finance/Finance";
import { filterShipments } from "../operations/ChapterOps";
import { COST_COLOR, Card, Metric, MetricRow, REVENUE_COLOR } from "../shared/ui";

const add = (rows, key) => rows.reduce((s, r) => s + (r[key] ?? 0), 0);

/** Net per period as bars above or below zero. */
function NetChart({ data }) {
  const [hover, setHover] = useState(null);
  const [ref, width] = useWidth(data.length > 0);
  if (!data.length) return <p className="combo-empty">No finance entries for these filters.</p>;
  const W = Math.max(width, 480, data.length * 40);
  const H = 240;
  const pad = { top: 14, right: 8, bottom: 34, left: 64 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const hi = Math.max(0, ...data.map((d) => d.net));
  const lo = Math.min(0, ...data.map((d) => d.net));
  const span = hi - lo || 1;
  const y = (v) => pad.top + ((hi - v) / span) * innerH;
  const band = innerW / data.length;
  const barW = Math.min(30, band * 0.6);
  const ticks = [hi, (hi + lo) / 2, lo, 0].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="combo-chart">
      <div className="combo-legend">
        <span><i style={{ background: REVENUE_COLOR }} />Money in more than out</span>
        <span><i style={{ background: COST_COLOR }} />Money out more than in</span>
      </div>
      <div className="combo-chart-scroll" ref={ref}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Net finances by period">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className={t === 0 ? "combo-zero" : "combo-grid"} />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="combo-axis">{formatUsdShort(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = pad.left + i * band;
            const top = Math.min(y(d.net), y(0));
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={x} y={pad.top} width={band} height={innerH} fill={hover === i ? "rgba(0,53,162,0.05)" : "transparent"} />
                <rect x={x + (band - barW) / 2} y={top} width={barW} height={Math.max(1, Math.abs(y(d.net) - y(0)))} rx="2" fill={d.net >= 0 ? REVENUE_COLOR : COST_COLOR} />
                <text x={x + band / 2} y={H - 12} textAnchor="middle" className="combo-axis">{d.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="combo-chart-readout" aria-live="polite">
        {hover == null
          ? "Hover a bar for exact numbers."
          : `${data[hover].label}: revenue ${formatUsd(data[hover].revenue)} − cost ${formatUsd(data[hover].cost)} = net ${formatUsd(data[hover].net)}`}
      </p>
    </div>
  );
}

export default function Home({ filters, goTo }) {
  const kpis = useApi("/kpis");
  const ships = useShipments();
  const fin = useFinance();
  const scores = useScores();

  const shipRows = useMemo(() => filterShipments(ships.rows, filters), [ships.rows, filters]);
  const finRows = useMemo(() => filterFinance(fin.rows, filters), [fin.rows, filters]);
  const t = financeTotals(finRows);

  // year over year ignores the semester filter: it always shows every year
  const yoy = useMemo(() => {
    const rows = ships.rows.filter((s) => filters.chapter !== HQ && matchChapters(s.chapters, filters));
    const years = [...new Set(rows.map((r) => r.year))].sort();
    return years.map((y) => ({ label: String(y), values: [add(rows.filter((r) => r.year === y), "valuation")] }));
  }, [ships.rows, filters]);
  const lastTwo = yoy.slice(-2);
  const yoyChange = lastTwo.length === 2 && lastTwo[0].values[0] ? lastTwo[1].values[0] / lastTwo[0].values[0] - 1 : null;

  const net = useMemo(() => {
    const bySemester = filters.semester === "all";
    const keys = bySemester ? sortSemesters(finRows.map((r) => r.semester)).reverse() : [...new Set(finRows.map((r) => r.month))].sort();
    return keys.map((k) => {
      const rows = finRows.filter((r) => (bySemester ? r.semester : r.month) === k);
      const tt = financeTotals(rows);
      return { label: bySemester ? k : formatMonth(k), ...tt };
    });
  }, [finRows, filters.semester]);

  const exp = useMemo(() => {
    if (!scores.data) return null;
    const sem = scores.data.semesters.at(-1);
    return summarize(scores.data, sem);
  }, [scores.data]);

  const loading = (r) => (r.loading ? "…" : r.error ? "—" : null);

  return (
    <div className="combo-stack">
      <Card label="Operations" title="Inventory and shipments" subtitle={`Inventory is HQ's warehouse. Shipments follow the filters: ${describeFilters(filters)}`}>
        <MetricRow>
          <Metric label="Units in inventory" value={loading(kpis) ?? formatNum(kpis.data.total_raw_items)} onClick={() => goTo("operations", "hq")} />
          <Metric label="Inventory value" value={loading(kpis) ?? formatUsd(kpis.data.total_value)} onClick={() => goTo("operations", "hq")} />
          <Metric label="Shipments" value={loading(ships) ?? formatNum(shipRows.length)} onClick={() => goTo("operations", "chapters")} />
          <Metric label="Value of supplies shipped" value={loading(ships) ?? formatUsd(add(shipRows, "valuation"))} onClick={() => goTo("operations", "chapters")} />
        </MetricRow>
      </Card>

      <Card label="Finance" title="Money in and out" subtitle={describeFilters(filters)}>
        <MetricRow>
          <Metric label="Revenue" value={loading(fin) ?? formatUsd(t.revenue)} onClick={() => goTo("finance")} />
          <Metric label="Cost" value={loading(fin) ?? formatUsd(t.cost)} hint="Not counting shipping" onClick={() => goTo("finance")} />
          <Metric label="Net" value={loading(fin) ?? formatUsd(t.net)} tone={t.net < 0 ? "bad" : undefined} onClick={() => goTo("finance")} />
          <Metric label="Shipping cost" value={loading(ships) ?? formatUsd(add(shipRows, "shipping_cost"))} hint="From the master shipment sheet" onClick={() => goTo("operations", "chapters")} />
        </MetricRow>
      </Card>

      <Card label="Expansion" title={exp ? `Chapter health · ${exp.sem}` : "Chapter health"} subtitle="Latest semester on the scores sheet">
        <MetricRow>
          <Metric label="Active chapters" value={loading(scores) ?? formatNum(exp.activeCount)} onClick={() => goTo("expansion")} />
          <Metric
            label="Average score"
            value={loading(scores) ?? (exp.avg == null ? "—" : exp.avg.toFixed(1))}
            hint={exp?.prevAvg != null && exp?.avg != null ? `${exp.avg - exp.prevAvg >= 0 ? "+" : "−"}${Math.abs(exp.avg - exp.prevAvg).toFixed(1)} vs ${exp.prev}` : undefined}
            onClick={() => goTo("expansion")}
          />
          <Metric label="Need attention" value={loading(scores) ?? formatNum(exp.attention.length)} tone={exp?.attention.length ? "bad" : undefined} onClick={() => goTo("expansion")} />
          <Metric label="New this semester" value={loading(scores) ?? formatNum(exp.newChapters.length)} onClick={() => goTo("expansion")} />
        </MetricRow>
      </Card>

      <div className="combo-two-col">
        <Card
          title="Value of supplies donated, year over year"
          subtitle={`From the master shipment sheet · ${filters.chapter === "all" || filters.chapter === "chapters" ? "every chapter" : filters.chapter}${yoyChange != null ? ` · ${yoyChange >= 0 ? "+" : ""}${formatPct(yoyChange)} vs the year before` : ""}`}
        >
          <BarChart data={yoy} series={[{ name: "Value of supplies", color: REVENUE_COLOR }]} format={formatUsdShort} />
        </Card>
        <Card title="Net finances" subtitle={`Revenue minus cost by ${filters.semester === "all" ? "semester" : "month"} · ${describeFilters(filters)}`}>
          <NetChart data={net} />
        </Card>
      </div>
    </div>
  );
}

