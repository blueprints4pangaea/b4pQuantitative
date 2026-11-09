// Home: the few numbers people check most, from each area, plus the ops
// donation charts (by year, map, destination type, by chapter) and net finances.
import { useEffect, useMemo, useState } from "react";
import { useApi } from "../shared/api";
import { ChapterBreakdown, DonatedValueChart } from "../DonationHistory";
import ShipmentMap from "../ShipmentMap";
import ShipmentMix from "../ShipmentMix";
import { LineChart } from "../shared/charts";
import { HQ } from "../shared/chapters";
import { describeFilters, filterShipments, matchChapters, useFinance, useScores, useShipments } from "../shared/data";
import { formatMonth, formatNum, formatUsdShort } from "../shared/format";
import { sortSemesters } from "../shared/semester";
import { summarize } from "../expansion/scoreStats";
import { filterFinance, financeTotals } from "../finance/Finance";
import { COST_COLOR, Card, Metric, REVENUE_COLOR } from "../shared/ui";

const add = (rows, key) => rows.reduce((s, r) => s + (r[key] ?? 0), 0);

/** Height for each chart, so the two chart rows fill what's left of the window. */
function useChartHeight() {
  const calc = () => Math.round(Math.min(230, Math.max(70, window.innerHeight / 2 - 310)));
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
        const label = name === HQ ? "HQ (UMich)" : name;
        const cur = m.get(label) ?? { chapter: label, valuation: 0, shipments: 0 };
        cur.valuation += (r.valuation ?? 0) / names.length;
        cur.shipments += 1;
        m.set(label, cur);
      }
    }
    return [...m.values()].sort((a, b) => b.valuation - a.valuation);
  }, [shipRows]);
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
        <Card title="Operations" className="combo-home-card" actions={chips(describeFilters(filters))}>
          <div className="combo-home-metrics">
            <Metric label="HQ units" value={loading(kpis) ?? formatNum(kpis.data.total_raw_items)} onClick={() => goTo("operations")} />
            <Metric label="HQ value" value={loading(kpis) ?? formatUsdShort(kpis.data.total_value)} onClick={() => goTo("operations")} />
            <Metric label="Shipments" value={loading(ships) ?? formatNum(shipRows.length)} onClick={() => goTo("operations")} />
            <Metric label="Shipped" value={loading(ships) ?? formatUsdShort(add(shipRows, "valuation"))} onClick={() => goTo("operations")} />
          </div>
        </Card>
        <Card title="Finance" className="combo-home-card" actions={chips(describeFilters(filters))}>
          <div className="combo-home-metrics">
            <Metric label="Revenue" value={loading(fin) ?? formatUsdShort(t.revenue)} onClick={() => goTo("finance")} />
            <Metric label="Cost" value={loading(fin) ?? formatUsdShort(t.cost)} onClick={() => goTo("finance")} />
            <Metric label="Net" value={loading(fin) ?? formatUsdShort(t.net)} tone={t.net < 0 ? "bad" : undefined} onClick={() => goTo("finance")} />
            <Metric label="Shipping" value={loading(ships) ?? formatUsdShort(add(shipRows, "shipping_cost"))} onClick={() => goTo("operations")} />
          </div>
        </Card>
        <Card title="Expansion" className="combo-home-card" actions={chips(exp ? `${exp.sem} scores` : "Chapter scores")}>
          <div className="combo-home-metrics">
            <Metric label="Active" value={loading(scores) ?? formatNum(exp.activeCount)} onClick={() => goTo("expansion")} />
            <Metric
              label="Avg score"
              value={loading(scores) ?? (exp.avg == null ? "—" : exp.avg.toFixed(1))}
              hint={exp?.prevAvg != null && exp?.avg != null ? `${exp.avg - exp.prevAvg >= 0 ? "▲" : "▼"} ${Math.abs(exp.avg - exp.prevAvg).toFixed(1)}` : undefined}
              onClick={() => goTo("expansion")}
            />
            <Metric label="Attention" value={loading(scores) ?? formatNum(exp.attention.length)} tone={exp?.attention.length ? "bad" : undefined} onClick={() => goTo("expansion")} />
            <Metric label="New" value={loading(scores) ?? formatNum(exp.newChapters.length)} onClick={() => goTo("expansion")} />
          </div>
        </Card>
      </div>

      <div className="combo-home-charts">
        <Card
          title="Supplies donated"
          className="combo-home-chart combo-home-span-2"
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
        <Card title="Where our supplies have gone" className="combo-home-chart combo-home-span-2">
          <ShipmentMap shipments={ships.loading ? null : shipRows} error={ships.error} />
        </Card>
        <Card title="Shipments by destination type" className="combo-home-chart combo-home-span-2">
          <ShipmentMix types={byType} />
        </Card>
        <Card title="Donated value by chapter" className="combo-home-chart combo-home-span-2">
          {byChapter.length ? <ChapterBreakdown chapters={byChapter} visible /> : <p className="combo-empty">Nothing to show for these filters.</p>}
        </Card>
        <Card
          title="Net finances"
          className="combo-home-chart combo-home-span-4"
          actions={
            <div className="combo-home-chart-meta">
              <span className="combo-chip">By {filters.semester === "all" ? "semester" : "month"}</span>
            </div>
          }
        >
          <LineChart
            data={net.map((d) => ({ label: d.label, values: [d.net, d.revenue, d.cost] }))}
            series={[
              { name: "Net", color: "#0035a2" },
              { name: "Revenue", color: REVENUE_COLOR, dashed: true },
              { name: "Cost", color: COST_COLOR, dashed: true },
            ]}
            format={formatUsdShort}
            height={chartH + 34}
          />
        </Card>
      </div>
    </div>
  );
}
