// Home: the few numbers people check most, from each area, plus the ops
// donation charts (by year, map, destination type, by chapter) and net finances.
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChapterBreakdown, DonatedValueChart } from "../DonationHistory";
import ShipmentMap from "../ShipmentMap";
import { LineChart } from "../shared/charts";
import { HQ } from "../shared/chapters";
import { describeFilters, filterShipments, matchChapters, useFinance, useScores, useShipments } from "../shared/data";
import { formatMonth, formatNum, formatUsdShort } from "../shared/format";
import { sortSemesters } from "../shared/semester";
import { summarize } from "../expansion/scoreStats";
import { filterFinance, financeTotals, shippingCostOf } from "../finance/Finance";
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
    </div>
  );
}

/** "▲ 12 vs 2025" under a tile; up is green unless upIsBad (e.g. expenses). */
function VsLastYear({ cur, prev, year, format, upIsBad = false }) {
  if (cur == null || prev == null || !year) return null;
  const diff = cur - prev;
  const good = upIsBad ? diff <= 0 : diff >= 0;
  return (
    <span className={good ? "combo-good" : "combo-bad"}>
      {diff >= 0 ? "▲" : "▼"} {format(Math.abs(diff))} <span className="combo-vs">vs {year}</span>
    </span>
  );
}

// Wide screens fit Home in one window: the map spans two rows on the left,
// the four smaller charts sit in a 2x2 grid on the right.
const ONE_SCREEN_MIN_WIDTH = 1200;

/** Chart sizes, from the window height left below the KPI cards. */
function useChartSize(chartsRef) {
  const calc = () => {
    const top = chartsRef.current ? chartsRef.current.getBoundingClientRect().top + window.scrollY : 420;
    const avail = window.innerHeight - top - 78; // the page keeps its bottom padding
    if (window.innerWidth < ONE_SCREEN_MIN_WIDTH) {
      const h = Math.round(Math.min(230, Math.max(140, window.innerHeight / 2 - 290)));
      return { chartH: h, mapH: h * 2 + 40, gridH: null };
    }
    const gridH = Math.max(440, avail);
    const row = (gridH - 10) / 2;
    return {
      gridH,
      chartH: Math.round(Math.min(260, Math.max(110, row - 100))),
      // the split card (about 150px) and the map card's title and legend take the rest
      mapH: Math.round(Math.max(140, gridH - 300)),
    };
  };
  const [size, setSize] = useState({ chartH: 180, mapH: 400, gridH: null });
  useLayoutEffect(() => {
    const on = () => setSize(calc());
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return size;
}

export default function Home({ filters, goTo }) {
  const chartsRef = useRef(null);
  const { chartH, mapH, gridH } = useChartSize(chartsRef);
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
  const [prevYear, curYear] = lastTwo.length === 2 ? lastTwo : [null, null];

  // finance this year vs last year, for the chapter picked (semester filter ignored, like the year chart)
  const finYoy = useMemo(() => {
    const rows = filterFinance(fin.rows, { ...filters, semester: "all" });
    const years = [...new Set(rows.map((r) => r.date.slice(0, 4)))].sort();
    if (years.length < 2) return null;
    const [py, cy] = years.slice(-2);
    return {
      year: py,
      prev: financeTotals(rows.filter((r) => r.date.startsWith(py))),
      cur: financeTotals(rows.filter((r) => r.date.startsWith(cy))),
    };
  }, [fin.rows, filters]);

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
        <Card title="Operations Overview" className="combo-home-card combo-home-card-two" actions={chips(describeFilters(filters))}>
          <div className="combo-home-metrics">
            <Metric
              label="Total Shipments"
              value={loading(ships) ?? formatNum(shipRows.length)}
              hint={curYear && <VsLastYear cur={curYear.shipments} prev={prevYear.shipments} year={prevYear.year} format={formatNum} />}
              onClick={() => goTo("operations")}
            />
            <Metric
              label="Value Shipped"
              value={loading(ships) ?? formatUsdShort(add(shipRows, "valuation"))}
              hint={curYear && <VsLastYear cur={curYear.valuation} prev={prevYear.valuation} year={prevYear.year} format={formatUsdShort} />}
              onClick={() => goTo("operations")}
            />
          </div>
        </Card>
        <Card title="Financial Overview" className="combo-home-card" actions={chips(describeFilters(filters))}>
          <div className="combo-home-metrics">
            <Metric
              label="Total Revenue"
              value={loading(fin) ?? formatUsdShort(t.revenue)}
              hint={finYoy && <VsLastYear cur={finYoy.cur.revenue} prev={finYoy.prev.revenue} year={finYoy.year} format={formatUsdShort} />}
              onClick={() => goTo("finance")}
            />
            <Metric
              label="Total Expenses"
              value={loading(fin) ?? formatUsdShort(t.cost)}
              hint={finYoy && <VsLastYear cur={finYoy.cur.cost} prev={finYoy.prev.cost} year={finYoy.year} format={formatUsdShort} upIsBad />}
              onClick={() => goTo("finance")}
            />
            <Metric
              label="Net Income"
              value={loading(fin) ?? formatUsdShort(t.net)}
              tone={t.net < 0 ? "bad" : undefined}
              hint={finYoy && <VsLastYear cur={finYoy.cur.net} prev={finYoy.prev.net} year={finYoy.year} format={formatUsdShort} />}
              onClick={() => goTo("finance")}
            />
            <Metric label="Shipping Costs" value={loading(fin) ?? formatUsdShort(shippingCostOf(finRows))} hint="From the finance sheets" onClick={() => goTo("finance")} />
          </div>
        </Card>
        <Card title="Chapter Expansion" className="combo-home-card" actions={chips(exp ? `${exp.sem} Scores` : "Chapter Scores")}>
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

      <div className="combo-home-charts" ref={chartsRef} style={gridH ? { height: `${gridH}px` } : undefined}>
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
        {/* map with the local/international split under it (on wide screens they share the left column) */}
        <div className="combo-home-left">
          <Card title="Global Distribution of Supplies" className="combo-home-chart combo-home-map">
            <ShipmentMap shipments={ships.loading ? null : shipRows} error={ships.error} maxHeight={mapH} />
          </Card>
          <Card title="Local vs. International Shipments" className="combo-home-chart combo-home-split">
            <DestinationSplit types={byType} />
          </Card>
        </div>
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
