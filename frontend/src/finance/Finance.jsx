// Finance, ported from the Blueprints financeDashboard with these
// tabs: Overview & KPIs, Revenue, Expenses and Chapters.
// Chapter and semester come from the shared filter bar; Year and Month are the
// finance dashboard's own extra filters.
// Shipping is not a finance category: shipping cost comes from the master
// shipment sheet and is shown next to finance cost, never added into it twice.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Donut, LineChart, MoneyFlowChart, ShareBars } from "../shared/charts";
import { HQ } from "../shared/chapters";
import { describeFilters, matchChapters, matchEntity, matchSemester, useFinance, useShipments } from "../shared/data";
import { formatMonth, formatNum, formatPct, formatUsd, formatUsdShort } from "../shared/format";
import { sortSemesters } from "../shared/semester";
import { COST_COLOR, Card, ErrorText, HeaderStatus, Loading, Metric, MetricRow, Notice, REVENUE_COLOR, Subtabs, Table } from "../shared/ui";

const NET_COLOR = "#0035a2";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LEDGER_PAGE = 10;

const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);
const showEntity = (e) => (e === HQ ? "HQ (UMich)" : e);

function groupSum(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = r[key] || "Unlabeled";
    const cur = m.get(k) ?? { name: k, value: 0, count: 0 };
    cur.value += r.amount;
    cur.count += 1;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.value - a.value);
}

export function financeTotals(rows) {
  const revenue = sum(rows.filter((r) => r.flow === "revenue"));
  const cost = sum(rows.filter((r) => r.flow === "cost"));
  return { revenue, cost, net: revenue - cost };
}

export function filterFinance(rows, filters) {
  return rows.filter((r) => matchEntity(r.entity, filters) && matchSemester(r, filters));
}

const matchPeriod = (r, period) =>
  (period.year === "all" || r.date.slice(0, 4) === period.year) && (period.month === "all" || r.date.slice(5, 7) === period.month);

function periodLabel(period) {
  const m = period.month === "all" ? "" : MONTHS[Number(period.month) - 1];
  const y = period.year === "all" ? "" : period.year;
  return [m, y].filter(Boolean).join(" ");
}

/** Revenue, cost and net per month, oldest first. */
function monthly(rows) {
  const m = new Map();
  for (const r of rows) {
    const cur = m.get(r.month) ?? { key: r.month, revenue: 0, cost: 0 };
    cur[r.flow] += r.amount;
    m.set(r.month, cur);
  }
  return [...m.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((d) => ({ ...d, label: formatMonth(d.key), net: d.revenue - d.cost }));
}

// --- small building blocks ---

function SearchBox({ value, onChange, placeholder }) {
  return <input type="search" className="search-input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function Pager({ page, pages, total, onPage }) {
  if (pages <= 1) return <p className="combo-pager">{formatNum(total)} entries</p>;
  return (
    <div className="combo-pager">
      <span>
        Page {page} of {pages} · {formatNum(total)} entries
      </span>
      <button type="button" className="secondary-button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <button type="button" className="secondary-button" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

const searchText = (r) => [r.id, r.date, r.entity, r.category, r.source, r.notes, r.sheet, String(r.amount)].join(" ").toLowerCase();

/** Search, a category filter and pages of `pageSize`, like the finance dashboard's ledgers. */
function Ledger({ rows, columns, placeholder, pageSize = LEDGER_PAGE, children }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);
  const q = query.trim().toLowerCase();
  const shown = rows
    .filter((r) => (category === "all" || r.category === category) && (!q || searchText(r).includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const p = Math.min(page, pages);
  const reset = (fn) => (v) => {
    fn(v);
    setPage(1);
  };
  return (
    <>
      <div className="combo-toolbar">
        {children}
        <SearchBox value={query} onChange={reset(setQuery)} placeholder={placeholder} />
        <select className="shipment-filter-select" value={category} onChange={(e) => reset(setCategory)(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="combo-toolbar-count">{formatUsd(sum(shown))} total</span>
      </div>
      <Table columns={columns} rows={shown.slice((p - 1) * pageSize, p * pageSize)} rowKey={(r) => r.id} />
      <Pager page={p} pages={pages} total={shown.length} onPage={setPage} />
    </>
  );
}

const ledgerColumns = (flow) => [
  { key: "date", label: "Date", render: (r) => <span className="combo-nowrap">{r.date}</span> },
  { key: "entity", label: "Chapter", render: (r) => <span className="combo-nowrap">{showEntity(r.entity)}</span> },
  { key: "category", label: "Category" },
  { key: "source", label: flow === "revenue" ? "From" : "Paid to" },
  { key: "amount", label: "Amount", align: "right", render: (r) => formatUsd(r.amount) },
  { key: "notes", label: "Notes", render: (r) => <span title={r.notes}>{r.notes}</span> },
];

// --- header pieces ---

/** Data status, shown in the page header under the title. */
function StatusBar({ fin, onSync, syncing }) {
  const live = Object.values(fin.origins).filter((o) => o.origin === "sheet").length;
  const all = Object.values(fin.origins).length;
  const pulled = fin.data?.pulledAt ? new Date(fin.data.pulledAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";
  return (
    <HeaderStatus>
      <p className="combo-fineprint combo-status-line" aria-live="polite">
        <span>
          <i className={`combo-status-dot${live === all && all ? " live" : ""}`} />
          {live === all && all ? "Live from Google Sheets" : live ? "Partly live, partly sample data" : "Sample data"}
        </span>
        <span>Last synced {pulled}</span>
        <span>{formatNum(fin.rows.length)} records</span>
        <button type="button" className="combo-link-button" onClick={onSync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </p>
    </HeaderStatus>
  );
}

/** Year and Month, shown in the shared filter bar next to Chapter and Semester. */
function PeriodFilters({ period, setPeriod, years }) {
  const [slot, setSlot] = useState(null);
  useEffect(() => setSlot(document.getElementById("combo-extra-filters")), []);
  const set = (key) => (e) => setPeriod({ ...period, [key]: e.target.value });
  if (!slot) return null;
  return createPortal(
    <>
      <label>
        <span className="title-block-label">Year</span>
        <select className="shipment-filter-select" value={period.year} onChange={set("year")}>
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="title-block-label">Month</span>
        <select className="shipment-filter-select" value={period.month} onChange={set("month")}>
          <option value="all">All months</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </select>
      </label>
      {(period.year !== "all" || period.month !== "all") && (
        <button type="button" className="secondary-button" onClick={() => setPeriod({ year: "all", month: "all" })}>
          Reset year and month
        </button>
      )}
    </>,
    slot
  );
}

// --- tabs ---

/** Month-over-month change for the picked month, against the month before it. */
function Variance({ scoped, period }) {
  if (period.month === "all") return null;
  const months = monthly(scoped);
  const i = months.findIndex((m) => m.key.slice(5, 7) === period.month && (period.year === "all" || m.key.slice(0, 4) === period.year));
  if (i < 1) return null;
  const cur = months[i];
  const prev = months[i - 1];
  const pct = (a, b) => (b > 0 ? ` (${(((a - b) / b) * 100).toFixed(1)}%)` : "");
  const signed = (n) => (n >= 0 ? `+${formatUsd(n)}` : formatUsd(n));
  return (
    <div className="combo-variance">
      <strong>
        Month over month: {cur.label} vs {prev.label}
      </strong>
      <span>
        Revenue{" "}
        <span className={cur.revenue >= prev.revenue ? "combo-good" : "combo-bad"}>
          {signed(cur.revenue - prev.revenue)}
          {pct(cur.revenue, prev.revenue)}
        </span>
      </span>
      <span>
        Expenses{" "}
        <span className={cur.cost <= prev.cost ? "combo-good" : "combo-bad"}>
          {signed(cur.cost - prev.cost)}
          {pct(cur.cost, prev.cost)}
        </span>
      </span>
    </div>
  );
}

function Overview({ rows, scoped, period, filters, shippingCost }) {
  const t = financeTotals(rows);
  const flow = monthly(rows);
  return (
    <>
      <Variance scoped={scoped} period={period} />
      <MetricRow>
        <Metric label="Total Revenue" value={formatUsd(t.revenue)} hint={`${formatNum(rows.filter((r) => r.flow === "revenue").length)} entries`} />
        <Metric label="Total Expenses" value={formatUsd(t.cost)} hint="Not counting shipping" />
        <Metric
          label="Net Margin"
          value={t.net >= 0 ? `+${formatUsd(t.net)}` : formatUsd(t.net)}
          tone={t.net < 0 ? "bad" : undefined}
          hint={t.revenue ? `${formatPct(t.net / t.revenue)} operating margin` : undefined}
        />
        <Metric label="Shipping Costs" value={formatUsd(shippingCost)} hint="From the master shipment sheet" />
      </MetricRow>
      <Card
        title="Revenue, Expenses and Net Income"
        subtitle={`Monthly revenue and expenses, with net income as a line · ${describeFilters(filters)}${periodLabel(period) ? ` · ${periodLabel(period)}` : ""}`}
        actions={
          <div className="combo-metric-inline">
            <p className="title-block-label">Total net</p>
            <p className={t.net < 0 ? "combo-bad" : "combo-good"}>{formatUsd(t.net)}</p>
          </div>
        }
      >
        <MoneyFlowChart data={flow} colors={{ revenue: REVENUE_COLOR, cost: COST_COLOR, net: NET_COLOR }} format={formatUsdShort} />
      </Card>
    </>
  );
}

/** Semester bars when every semester is shown, month bars inside one semester. */
function periodChart(rows, filters) {
  if (filters.semester === "all") {
    const labels = sortSemesters(rows.map((r) => r.semester)).reverse();
    return { by: "semester", data: labels.map((l) => ({ label: l, values: [sum(rows.filter((r) => r.semester === l))] })) };
  }
  return { by: "month", data: monthly(rows).map((m) => ({ label: m.label, values: [m.revenue + m.cost] })) };
}

const BIFURCATION = [
  { id: "all", label: "All Inflows" },
  { id: "grants", label: "Grants & Sponsorships" },
  { id: "donations", label: "Donations & Fundraisers" },
  { id: "other", label: "Other Streams" },
];

function bifurcate(r, tab) {
  const c = r.category.toLowerCase();
  const grant = c.includes("grant") || c.includes("sponsor");
  const donation = c.includes("donat") || c.includes("fundrais") || c.includes("event");
  if (tab === "grants") return grant;
  if (tab === "donations") return donation;
  if (tab === "other") return !grant && !donation;
  return true;
}

function Revenue({ rows, filters }) {
  const [split, setSplit] = useState("all");
  const mine = rows.filter((r) => r.flow === "revenue");
  const bySource = groupSum(mine, "source");
  const total = sum(mine) || 1;
  const chart = periodChart(mine, filters);
  return (
    <>
      <MetricRow>
        <Metric label="Total Revenue" value={formatUsd(sum(mine))} />
        <Metric label="Largest Source" value={bySource[0]?.name ?? "—"} hint={bySource[0] ? formatUsd(bySource[0].value) : undefined} />
      </MetricRow>
      <Card title={`Revenue by ${chart.by === "month" ? "Month" : "Semester"}`} subtitle={describeFilters(filters)}>
        <LineChart height={240} data={chart.data} series={[{ name: "Revenue", color: REVENUE_COLOR }]} format={formatUsdShort} />
      </Card>
      <div className="combo-two-col">
        <Card title="Revenue by Source" subtitle="Who the money comes from">
          <ShareBars items={bySource} format={formatUsd} color={REVENUE_COLOR} />
        </Card>
        <Card title="Revenue by Program Category" subtitle="Grants, donations, sponsorships and fundraising">
          <ShareBars items={groupSum(mine, "category")} format={formatUsd} color={REVENUE_COLOR} />
        </Card>
      </div>
      <Card title="Revenue Sources" subtitle="Every stream, biggest first">
        <Table
          columns={[
            { key: "name", label: "Source" },
            { key: "count", label: "Transactions", align: "right" },
            { key: "value", label: "Amount", align: "right", render: (r) => formatUsd(r.value) },
            { key: "share", label: "Share of total", align: "right", render: (r) => formatPct(r.value / total) },
          ]}
          rows={bySource}
          rowKey={(r) => r.name}
        />
      </Card>
      <Card title="Revenue Ledger" subtitle="Every inbound grant, sponsorship, donation and fundraising receipt">
        <Subtabs tabs={BIFURCATION} value={split} onChange={setSplit} />
        <Ledger key={split} rows={mine.filter((r) => bifurcate(r, split))} columns={ledgerColumns("revenue")} placeholder="Search the revenue ledger" />
      </Card>
    </>
  );
}

function Cost({ rows, filters, shippingCost }) {
  const mine = rows.filter((r) => r.flow === "cost");
  const byCategory = groupSum(mine, "category");
  const chart = periodChart(mine, filters);
  return (
    <>
      <MetricRow>
        <Metric label="Total Expenses" value={formatUsd(sum(mine))} hint="Not counting shipping" />
        <Metric label="Largest Category" value={byCategory[0]?.name ?? "—"} hint={byCategory[0] ? formatUsd(byCategory[0].value) : undefined} />
        <Metric label="Shipping Costs" value={formatUsd(shippingCost)} hint="From the master shipment sheet" />
      </MetricRow>
      <div className="combo-chart-side">
        <Card title={`Expenses by ${chart.by === "month" ? "Month" : "Semester"}`} subtitle={describeFilters(filters)}>
          <LineChart height={330} data={chart.data} series={[{ name: "Expenses", color: COST_COLOR }]} format={formatUsdShort} />
        </Card>
        <Card title="Expenses by Category" subtitle="Where the money goes" className="combo-side-donut">
          <Donut items={byCategory} format={formatUsd} centerLabel="Total cost" />
        </Card>
      </div>
      <Card title="Expense Ledger" subtitle="Every cost entry, newest first">
        <Ledger rows={mine} columns={ledgerColumns("cost")} placeholder="Search the expense ledger" />
      </Card>
    </>
  );
}

/** Per chapter totals, with the finance dashboard's tiers (by months with entries). */
function chapterRows(rows) {
  const totals = financeTotals(rows);
  const m = new Map();
  for (const r of rows) {
    const cur = m.get(r.entity) ?? { chapter: r.entity, revenue: 0, cost: 0, count: 0, months: new Set() };
    cur[r.flow] += r.amount;
    cur.count += 1;
    cur.months.add(r.month);
    m.set(r.entity, cur);
  }
  return [...m.values()].map((c) => {
    const net = c.revenue - c.cost;
    const months = c.months.size;
    return {
      chapter: c.chapter,
      tier: c.chapter === HQ ? "Central operations" : months >= 5 ? "Established" : months >= 2 ? "Growing" : "Expanding / emerging",
      revenue: c.revenue,
      cost: c.cost,
      net,
      margin: c.revenue > 0 ? net / c.revenue : 0,
      count: c.count,
      months,
      revShare: totals.revenue ? c.revenue / totals.revenue : 0,
      costShare: totals.cost ? c.cost / totals.cost : 0,
    };
  });
}

function exportCsv(rows) {
  const head = ["Chapter", "Tier", "Revenue", "Cost", "Net", "Margin %", "Transactions", "Active months", "Revenue share %", "Cost share %"];
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = rows.map((c) =>
    [
      q(showEntity(c.chapter)),
      q(c.tier),
      c.revenue.toFixed(2),
      c.cost.toFixed(2),
      c.net.toFixed(2),
      (c.margin * 100).toFixed(1),
      c.count,
      c.months,
      (c.revShare * 100).toFixed(1),
      (c.costShare * 100).toFixed(1),
    ].join(",")
  );
  const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `b4p-chapter-finance-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Chapters({ rows, filters, setFilters }) {
  const [scope, setScope] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "revenue", asc: false });
  const all = chapterRows(rows);
  const q = query.trim().toLowerCase();
  const shown = all
    .filter((c) => (scope === "all" ? true : scope === "hq" ? c.chapter === HQ : c.chapter !== HQ))
    .filter((c) => !q || `${showEntity(c.chapter)} ${c.tier}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const A = a[sort.key];
      const B = b[sort.key];
      const d = typeof A === "string" ? A.localeCompare(B) : A - B;
      return sort.asc ? d : -d;
    });
  const head = (key, label) => (
    <button type="button" className="combo-sort" onClick={() => setSort({ key, asc: sort.key === key ? !sort.asc : false })}>
      {label}
      {sort.key === key ? (sort.asc ? " ▲" : " ▼") : ""}
    </button>
  );
  const money = (key) => (r) => formatUsd(r[key]);
  return (
    <Card
      title="Chapter Financial Summary"
      subtitle="Every chapter and HQ side by side for the chosen period. Click a chapter to filter the dashboard to it."
      actions={
        <button type="button" className="secondary-button" onClick={() => exportCsv(shown)}>
          Export CSV report
        </button>
      }
    >
      <div className="combo-toolbar combo-toolbar-scope">
        <Subtabs
          tabs={[
            { id: "all", label: "Everyone" },
            { id: "hq", label: "HQ only" },
            { id: "chapters", label: "Chapters only" },
          ]}
          value={scope}
          onChange={setScope}
        />
        <SearchBox value={query} onChange={setQuery} placeholder="Search chapters or tiers" />
      </div>
      <Table
        columns={[
          {
            key: "chapter",
            label: head("chapter", "Chapter"),
            render: (r) => (
              <button type="button" className="combo-sort" onClick={() => setFilters({ ...filters, chapter: r.chapter })}>
                <span className="combo-nowrap">{showEntity(r.chapter)}</span>
              </button>
            ),
          },
          { key: "tier", label: head("tier", "Tier"), render: (r) => <span className="combo-tier">{r.tier}</span> },
          { key: "revenue", label: head("revenue", "Revenue"), align: "right", render: money("revenue") },
          { key: "cost", label: head("cost", "Expenses"), align: "right", render: money("cost") },
          {
            key: "net",
            label: head("net", "Net"),
            align: "right",
            render: (r) => <span className={r.net < 0 ? "combo-bad" : "combo-good"}>{formatUsd(r.net)}</span>,
          },
          { key: "margin", label: head("margin", "Margin"), align: "right", render: (r) => formatPct(r.margin) },
          { key: "count", label: head("count", "Entries"), align: "right" },
          { key: "months", label: head("months", "Months"), align: "right" },
          { key: "revShare", label: head("revShare", "Share rev / cost"), align: "right", render: (r) => `${formatPct(r.revShare)} / ${formatPct(r.costShare)}` },
        ]}
        rows={shown}
        rowKey={(r) => r.chapter}
        highlight={(r) => r.chapter === filters.chapter}
      />
    </Card>
  );
}

const TABS = [
  { id: "overview", label: "Overview & KPIs" },
  { id: "revenue", label: "Revenue" },
  { id: "cost", label: "Expenses" },
  { id: "chapters", label: "Chapters" },
];

export default function Finance({ filters, setFilters }) {
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState({ year: "all", month: "all" });
  const [syncing, setSyncing] = useState(false);
  const fin = useFinance();
  const ships = useShipments();

  // scoped: shared filters only (for month-over-month); rows: plus year and month
  const scoped = useMemo(() => filterFinance(fin.rows, filters), [fin.rows, filters]);
  const rows = useMemo(() => scoped.filter((r) => matchPeriod(r, period)), [scoped, period]);
  // the chapter table compares everyone, so it skips the chapter filter
  const everyone = useMemo(
    () => fin.rows.filter((r) => matchSemester(r, filters) && matchPeriod(r, period)),
    [fin.rows, filters, period]
  );
  const years = useMemo(() => [...new Set(fin.rows.map((r) => r.date.slice(0, 4)))].sort().reverse(), [fin.rows]);

  if (fin.loading && !fin.data) return <Loading what="finance sheets" />;
  if (fin.error) return <ErrorText>{fin.error}</ErrorText>;

  const sync = async () => {
    setSyncing(true);
    try {
      await fin.reload("/finance?nocache=true");
    } finally {
      setSyncing(false);
    }
  };

  const shippingCost = ships.rows
    .filter((s) => matchChapters(s.chapters, filters) && matchSemester(s, filters) && matchPeriod({ date: `${s.year}-${String(s.month).padStart(2, "0")}` }, period))
    .reduce((s, x) => s + (x.shipping_cost ?? 0), 0);
  const samples = Object.values(fin.origins).filter((o) => o.origin === "sample").map((o) => o.label);

  return (
    <div className="combo-stack">
      <StatusBar fin={fin} onSync={sync} syncing={syncing} />
      {samples.length > 0 && (
        <Notice>
          Showing <strong>made-up sample data</strong> for {samples.join(", ")}. Set the sheet links in Vercel to use the real sheets.
        </Notice>
      )}
      <PeriodFilters period={period} setPeriod={setPeriod} years={years} />
      <Subtabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "overview" && <Overview rows={rows} scoped={scoped} period={period} filters={filters} shippingCost={shippingCost} />}
      {tab === "revenue" && <Revenue rows={rows} filters={filters} />}
      {tab === "cost" && <Cost rows={rows} filters={filters} shippingCost={shippingCost} />}
      {tab === "chapters" && <Chapters rows={everyone} filters={filters} setFilters={setFilters} />}
    </div>
  );
}
