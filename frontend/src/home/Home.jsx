// Home: the few numbers people check most, from each area, plus two charts:
// value of supplies donated year over year, and net finances over time.
import { useMemo } from "react";
import { useApi } from "../shared/api";
import { LineChart } from "../shared/charts";
import { HQ } from "../shared/chapters";
import { describeFilters, filterShipments, matchChapters, useFinance, useScores, useShipments } from "../shared/data";
import { formatMonth, formatNum, formatPct, formatUsdShort } from "../shared/format";
import { sortSemesters } from "../shared/semester";
import { summarize } from "../expansion/scoreStats";
import { filterFinance, financeTotals } from "../finance/Finance";
import { COST_COLOR, Card, Metric, REVENUE_COLOR } from "../shared/ui";

const add = (rows, key) => rows.reduce((s, r) => s + (r[key] ?? 0), 0);

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
    const rows = ships.rows.filter((s) => matchChapters(s.chapters, filters));
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

  const sub = (text) => <p className="combo-home-sub">{text}</p>;

  return (
    <div className="combo-home">
      <div className="combo-home-kpis">
        <Card label="Operations" className="combo-home-card">
          {sub(`Inventory: HQ · Shipments: ${describeFilters(filters)}`)}
          <div className="combo-home-metrics">
            <Metric label="Units in inventory" value={loading(kpis) ?? formatNum(kpis.data.total_raw_items)} onClick={() => goTo("operations")} />
            <Metric label="Inventory value" value={loading(kpis) ?? formatUsdShort(kpis.data.total_value)} onClick={() => goTo("operations")} />
            <Metric label="Shipments" value={loading(ships) ?? formatNum(shipRows.length)} onClick={() => goTo("operations")} />
            <Metric label="Value shipped" value={loading(ships) ?? formatUsdShort(add(shipRows, "valuation"))} onClick={() => goTo("operations")} />
          </div>
        </Card>
        <Card label="Finance" className="combo-home-card">
          {sub(describeFilters(filters))}
          <div className="combo-home-metrics">
            <Metric label="Revenue" value={loading(fin) ?? formatUsdShort(t.revenue)} onClick={() => goTo("finance")} />
            <Metric label="Cost" value={loading(fin) ?? formatUsdShort(t.cost)} onClick={() => goTo("finance")} />
            <Metric label="Net" value={loading(fin) ?? formatUsdShort(t.net)} tone={t.net < 0 ? "bad" : undefined} onClick={() => goTo("finance")} />
            <Metric label="Shipping cost" value={loading(ships) ?? formatUsdShort(add(shipRows, "shipping_cost"))} onClick={() => goTo("operations")} />
          </div>
        </Card>
        <Card label="Expansion" className="combo-home-card">
          {sub(exp ? `Chapter scores · ${exp.sem}` : "Chapter scores")}
          <div className="combo-home-metrics">
            <Metric label="Active chapters" value={loading(scores) ?? formatNum(exp.activeCount)} onClick={() => goTo("expansion")} />
            <Metric
              label={exp?.prev ? `Avg score (vs ${exp.prev})` : "Avg score"}
              value={
                loading(scores) ??
                (exp.avg == null
                  ? "—"
                  : `${exp.avg.toFixed(1)}${exp.prevAvg != null ? ` ${exp.avg - exp.prevAvg >= 0 ? "▲" : "▼"}${Math.abs(exp.avg - exp.prevAvg).toFixed(1)}` : ""}`)
              }
              onClick={() => goTo("expansion")}
            />
            <Metric label="Need attention" value={loading(scores) ?? formatNum(exp.attention.length)} tone={exp?.attention.length ? "bad" : undefined} onClick={() => goTo("expansion")} />
            <Metric label="New chapters" value={loading(scores) ?? formatNum(exp.newChapters.length)} onClick={() => goTo("expansion")} />
          </div>
        </Card>
      </div>

      <div className="combo-two-col">
        <Card
          title="Value of supplies donated, year over year"
          subtitle={`${filters.chapter === "all" ? "All of B4P" : filters.chapter === "chapters" ? "All chapters" : filters.chapter === HQ ? "HQ (UMich)" : filters.chapter}${yoyChange != null ? ` · ${yoyChange >= 0 ? "+" : ""}${formatPct(yoyChange)} vs the year before` : ""}`}
        >
          <LineChart data={yoy} series={[{ name: "Value of supplies donated", color: REVENUE_COLOR }]} format={formatUsdShort} />
        </Card>
        <Card title="Net finances" subtitle={`Revenue minus cost by ${filters.semester === "all" ? "semester" : "month"} · ${describeFilters(filters)}`}>
          <LineChart
            data={net.map((d) => ({ label: d.label, values: [d.net, d.revenue, d.cost] }))}
            series={[
              { name: "Net", color: "#0035a2" },
              { name: "Revenue", color: REVENUE_COLOR, dashed: true },
              { name: "Cost", color: COST_COLOR, dashed: true },
            ]}
            format={formatUsdShort}
          />
        </Card>
      </div>
    </div>
  );
}
