// Home: the few numbers people check most, from each area, plus the ops
// donation charts (by year, map, destination type, by chapter) and net finances.
import { useEffect, useMemo, useState } from "react";
import { useApi } from "../shared/api";
import { ChapterBreakdown, DonatedValueChart } from "../DonationHistory";
import ShipmentMap from "../ShipmentMap";
import { LineChart } from "../shared/charts";
import { HQ } from "../shared/chapters";
import { describeFilters, filterShipments, matchChapters, useFinance, useScores, useShipments } from "../shared/data";
import { formatMonth, formatNum, formatUsdShort } from "../shared/format";
import { sortSemesters } from "../shared/semester";
import { summarize } from "../expansion/scoreStats";
import { filterFinance, financeTotals } from "../finance/Finance";
import { COST_COLOR, Card, Metric, REVENUE_COLOR } from "../shared/ui";

const add = (rows, key) => rows.reduce((s, r) => s + (r[key] ?? 0), 0);

/** Local and international shipments as two number tiles with their share. */
function DestinationSplit({ types }) {
  const total = types.reduce((n, t) => n + t.count, 0) || 1;
  return (
    <div className="combo-split">
      {types.map((t) => (
        <div key={t.type} className="combo-split-tile">
          <p className="metric-label">{t.type}</p>
          <p className="metric-value">{formatNum(t.count)}</p>
          <p className="combo-split-share">{Math.round((t.count / total) * 100)}% of Shipments</p>
          <p className="combo-split-detail">
            {formatUsdShort(t.valuation)} · {formatNum(Math.round(t.pounds))} lbs
          </p>
        </div>
      ))}
      <div className="combo-split-bar" aria-hidden="true">
        {types.map((t) => (
          <span key={t.type} className={`combo-split-bar-${t.type.toLowerCase()}`} style={{ flexGrow: t.count || 0.0001 }} />
        ))}
      </div>
    </div>
  );
}

// Small line icons for the three overview cards.
const ICONS = {
  ops: <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm0 0 9 4.5m0 0 9-4.5M12 12v9" />,
  fin: <path d="M12 3v18M16.5 7.5c-.8-1.3-2.4-2-4.5-2-2.6 0-4.5 1.3-4.5 3.2 0 4.6 9.3 2.3 9.3 6.9 0 1.9-2 3.4-4.8 3.4-2.2 0-4-.8-4.8-2.3" />,
  exp: <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
};

/** Card title with a coloured icon badge, so each area reads at a glance. */
function AreaTitle({ area, children }) {
  return (
    <span className="combo-area-title">
      <span className={`combo-area-icon combo-area-${area}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {ICONS[area]}
        </svg>
      </span>
      {children}
    </span>
  );
}

/** Height for each chart, so the two chart rows fill what's left of the window. */
function useChartHeight() {
  const calc = () => Math.round(Math.min(230, Math.max(140, window.innerHeight / 2 - 290)));
  const [h, setH] = useState(calc);
  useEffect(() => {
    const on = () => setH(calc());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return h;
}

export default function Home({ filters, goTo }) {
  const chartH = useChartHeight();
  const kpis = useApi("/kpis");
  const ships = useShipments();
  const fin = useFinance();
  const scores = useScores();

  const shipRows = useMemo(() => filterShipments(ships.rows, filters), [ships.rows, filters]);
  const finRows = useMemo(() => filterFinance(fin.rows, filters), [fin.rows, filters]);
  const t = financeTotals(finRows);

  // year over year ignores the semester filter: it always shows every year
  const yoy = useMemo(() => {
    const rows = ships.rows.filter((s) => matchChapters(s.chapters, filters));
    const years = [...new Set(rows.map((r) => r.year))].sort();
    return years.map((y) => {
      const inYear = rows.filter((r) => r.year === y);
      return { year: y, valuation: add(inYear, "valuation"), pounds: add(inYear, "pounds"), shipments: inYear.length };
    });
  }, [ships.rows, filters]);
  const lastTwo = yoy.slice(-2);

  // the same breakdowns Operations shows beside its map, for the filtered shipments
  const byType = useMemo(
    () =>
      ["Local", "International"].map((type) => {
        const rows = shipRows.filter((r) => r.shipment_type === type);
        return { type, count: rows.length, valuation: add(rows, "valuation"), pounds: add(rows, "pounds") };
      }),
    [shipRows]
  );
  const byChapter = useMemo(() => {
    const m = new Map();
    for (const r of shipRows) {
      const names = r.chapters.length ? r.chapters : ["Unassigned"];
      for (const name of names) {
        // a shipment shared with another chapter only counts the picked chapter's share
        if (filters.chapter === "chapters" ? name === HQ : filters.chapter !== "all" && name !== filters.chapter) continue;
        const label = name === HQ ? "HQ (UMich)" : name;
        const cur = m.get(label) ?? { chapter: label, valuation: 0, shipments: 0 };
        cur.valuation += (r.valuation ?? 0) / names.length;
        cur.shipments += 1;
        m.set(label, cur);
      }
    }
    return [...m.values()].sort((a, b) => b.valuation - a.valuation);
  }, [shipRows, filters.chapter]);
  const yoyChange = lastTwo.length === 2 && lastTwo[0].valuation ? lastTwo[1].valuation / lastTwo[0].valuation - 1 : null;

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

  // scope shown as small chips on the right of each card title
  const chips = (...labels) => (
    <div className="combo-home-chart-meta">
      {labels.filter(Boolean).map((l) => (
        <span key={l} className="combo-chip">
          {l}
        </span>
      ))}
    </div>
  );

  return (
    <div className="combo-home" style={{ "--home-chart-h": `${chartH}px` }}>
      <div className="combo-home-kpis">
        <Card title={<AreaTitle area="ops">Operations Overview</AreaTitle>} className="combo-home-card combo-home-card-ops" actions={chips(describeFilters(filters))}>
          <div className="combo-home-metrics">
            <Metric label="HQ Units on Hand" value={loading(kpis) ?? formatNum(kpis.data.total_raw_items)} onClick={() => goTo("operations")} />
            <Metric label="HQ Stock Value" value={loading(kpis) ?? formatUsdShort(kpis.data.total_value)} onClick={() => goTo("operations")} />
            <Metric label="Total Shipments" value={loading(ships) ?? formatNum(shipRows.length)} onClick={() => goTo("operations")} />
            <Metric label="Value Shipped" value={loading(ships) ?? formatUsdShort(add(shipRows, "valuation"))} onClick={() => goTo("operations")} />
          </div>
        </Card>
        <Card title={<AreaTitle area="fin">Financial Overview</AreaTitle>} className="combo-home-card combo-home-card-fin" actions={chips(describeFilters(filters))}>
          <div className="combo-home-metrics">
            <Metric label="Total Revenue" value={loading(fin) ?? formatUsdShort(t.revenue)} onClick={() => goTo("finance")} />
            <Metric label="Total Expenses" value={loading(fin) ?? formatUsdShort(t.cost)} onClick={() => goTo("finance")} />
            <Metric label="Net Income" value={loading(fin) ?? formatUsdShort(t.net)} tone={t.net < 0 ? "bad" : undefined} onClick={() => goTo("finance")} />
            <Metric label="Shipping Costs" value={loading(ships) ?? formatUsdShort(add(shipRows, "shipping_cost"))} onClick={() => goTo("operations")} />
          </div>
        </Card>
        <Card title={<AreaTitle area="exp">Chapter Expansion</AreaTitle>} className="combo-home-card combo-home-card-exp" actions={chips(exp ? `${exp.sem} Scores` : "Chapter Scores")}>
          <div className="combo-home-metrics">
            <Metric label="Active Chapters" value={loading(scores) ?? formatNum(exp.activeCount)} onClick={() => goTo("expansion")} />
            <Metric
              label="Average Score"
              value={loading(scores) ?? (exp.avg == null ? "—" : exp.avg.toFixed(1))}
              hint={
                exp?.prevAvg != null && exp?.avg != null ? (
                  <span className={exp.avg - exp.prevAvg >= 0 ? "combo-good" : "combo-bad"}>
                    {exp.avg - exp.prevAvg >= 0 ? "▲" : "▼"} {Math.abs(exp.avg - exp.prevAvg).toFixed(1)}
                  </span>
                ) : undefined
              }
              onClick={() => goTo("expansion")}
            />
            <Metric label="Need Attention" value={loading(scores) ?? formatNum(exp.attention.length)} tone={exp?.attention.length ? "bad" : undefined} onClick={() => goTo("expansion")} />
            <Metric label="New Chapters" value={loading(scores) ?? formatNum(exp.newChapters.length)} onClick={() => goTo("expansion")} />
          </div>
        </Card>
      </div>

      <div className="combo-home-charts">
        <Card
          title="Value of Supplies Donated"
          className="combo-home-chart combo-home-year"
          actions={
            <div className="combo-home-chart-meta">
              {yoyChange != null && (
                <p className={yoyChange >= 0 ? "donation-yoy is-up" : "donation-yoy is-down"}>
                  <span className="donation-yoy-change">
                    <span aria-hidden="true">{yoyChange >= 0 ? "▲" : "▼"}</span> {Math.round(Math.abs(yoyChange) * 100)}% YoY
                  </span>
                  <span className="donation-yoy-detail">
                    {lastTwo[1].year} v {lastTwo[0].year}
                  </span>
                </p>
              )}
            </div>
          }
        >
          <DonatedValueChart years={yoy} title="" compact />
        </Card>
        <Card title="Global Distribution of Supplies" className="combo-home-chart combo-home-map">
          <ShipmentMap shipments={ships.loading ? null : shipRows} error={ships.error} maxHeight={Math.round(chartH * 2 + 40)} />
        </Card>
        <Card title="Local vs. International Shipments" className="combo-home-chart combo-home-split">
          <DestinationSplit types={byType} />
        </Card>
        <Card title="Donated Value by Chapter" className="combo-home-chart combo-home-chapters">
          {byChapter.length ? <ChapterBreakdown chapters={byChapter} visible /> : <p className="combo-empty">Nothing to show for these filters.</p>}
        </Card>
        <Card
          title="Net Financial Performance"
          className="combo-home-chart combo-home-net"
          actions={
            <div className="combo-home-chart-meta">
              <span className="combo-chip">By {filters.semester === "all" ? "Semester" : "Month"}</span>
            </div>
          }
        >
          <LineChart
            data={net.map((d) => ({ label: d.label, values: [d.net, d.revenue, d.cost] }))}
            series={[
              { name: "Net", color: "#0035a2" },
              { name: "Revenue", color: REVENUE_COLOR, dashed: true },
              { name: "Expenses", color: COST_COLOR, dashed: true },
            ]}
            format={formatUsdShort}
            height={chartH + 34}
          />
        </Card>
      </div>
    </div>
  );
}
