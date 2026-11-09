// Finance, ported from financeDashboard. Revenue and cost get their own tabs.
// Shipping is not a finance category: shipping cost comes from the master
// shipment sheet and is shown next to finance cost, never added into it twice.
import { useMemo, useState } from "react";
import { BarChart, ShareBars } from "../shared/charts";
import { HQ, chapterOptions } from "../shared/chapters";
import { describeFilters, matchChapters, matchEntity, matchSemester, useFinance, useShipments } from "../shared/data";
import { formatMonth, formatPct, formatUsd, formatUsdShort } from "../shared/format";
import { sortSemesters } from "../shared/semester";
import { COST_COLOR, Card, ErrorText, Loading, Metric, MetricRow, Notice, REVENUE_COLOR, Subtabs, Table } from "../shared/ui";

const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);

function groupSum(rows, key) {
  const m = new Map();
  for (const r of rows) m.set(r[key], (m.get(r[key]) ?? 0) + r.amount);
  return [...m.entries()].map(([name, value]) => ({ name, value }));
}

/** By semester when every semester is shown, by month inside one semester. */
function periods(rows, filters) {
  if (filters.semester === "all") {
    const labels = sortSemesters(rows.map((r) => r.semester)).reverse();
    return { labels, keyOf: (r) => r.semester, show: (l) => l };
  }
  const labels = [...new Set(rows.map((r) => r.month))].sort();
  return { labels, keyOf: (r) => r.month, show: formatMonth };
}

export function financeTotals(rows) {
  const revenue = sum(rows.filter((r) => r.flow === "revenue"));
  const cost = sum(rows.filter((r) => r.flow === "cost"));
  return { revenue, cost, net: revenue - cost };
}

export function filterFinance(rows, filters) {
  return rows.filter((r) => matchEntity(r.entity, filters) && matchSemester(r, filters));
}

function FlowTab({ flow, rows, allRows, filters }) {
  const mine = rows.filter((r) => r.flow === flow);
  const color = flow === "revenue" ? REVENUE_COLOR : COST_COLOR;
  const noun = flow === "revenue" ? "Revenue" : "Cost";
  const p = periods(mine, filters);
  const chart = p.labels.map((l) => ({ label: p.show(l), values: [sum(mine.filter((r) => p.keyOf(r) === l))] }));

  // chapter comparison ignores the chapter filter so chapters can be compared side by side
  const bySemester = allRows.filter((r) => r.flow === flow && matchSemester(r, filters));
  const entities = groupSum(bySemester, "entity").sort((a, b) => b.value - a.value);
  const total = entities.reduce((s, e) => s + e.value, 0) || 1;

  return (
    <>
      <MetricRow>
        <Metric label={`Total ${noun.toLowerCase()}`} value={formatUsd(sum(mine))} />
        <Metric label="Entries" value={mine.length} />
        <Metric label={`Average per ${filters.semester === "all" ? "semester" : "month"}`} value={formatUsd(p.labels.length ? sum(mine) / p.labels.length : 0)} />
        <Metric label={flow === "revenue" ? "Biggest source" : "Biggest category"} value={groupSum(mine, flow === "revenue" ? "source" : "category").sort((a, b) => b.value - a.value)[0]?.name ?? "—"} />
      </MetricRow>

      <Card title={`${noun} by ${filters.semester === "all" ? "semester" : "month"}`} subtitle={describeFilters(filters)}>
        <BarChart data={chart} series={[{ name: noun, color }]} format={formatUsdShort} />
      </Card>

      <div className="combo-two-col">
        <Card title={flow === "revenue" ? "Revenue by source" : "Cost by category"} subtitle={flow === "revenue" ? "Who the money comes from" : "Where the money goes"}>
          <ShareBars items={groupSum(mine, flow === "revenue" ? "source" : "category")} format={formatUsd} color={color} />
        </Card>
        <Card title={`${noun} by chapter`} subtitle="Every chapter and HQ for the chosen semester, so they can be compared">
          <Table
            columns={[
              { key: "name", label: "Chapter" },
              { key: "value", label: noun, align: "right", render: (r) => formatUsd(r.value) },
              { key: "share", label: "Share", align: "right", render: (r) => formatPct(r.value / total) },
            ]}
            rows={entities}
            rowKey={(r) => r.name}
            highlight={(r) => r.name === filters.chapter}
          />
        </Card>
      </div>

      <Card title={`${noun} entries`} subtitle="Newest first">
        <Table
          columns={[
            { key: "date", label: "Date" },
            { key: "entity", label: "Chapter" },
            { key: "category", label: "Category" },
            { key: "source", label: flow === "revenue" ? "From" : "Paid to" },
            { key: "amount", label: "Amount", align: "right", render: (r) => formatUsd(r.amount) },
            { key: "notes", label: "Notes" },
          ]}
          rows={[...mine].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50)}
        />
      </Card>
    </>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

/** Add one entry to the Revenue or Expenses sheet (ported from the finance dashboard's form). */
function AddEntry({ chapters }) {
  const blank = { type: "Revenue", date: new Date().toISOString().slice(0, 10), amount: "", category: "", source: "", chapter: HQ, notes: "" };
  const [form, setForm] = useState(blank);
  const [status, setStatus] = useState("");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setStatus("Saving…");
    try {
      const res = await fetch(`${API_BASE}/finance/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail ?? `Couldn't save (${res.status}).`);
      setStatus(
        body.written_to_gspread
          ? `Saved to the ${body.sheet_target}. Refresh the page to see it in the charts.`
          : "Not saved to Google Sheets: the service account isn't set up for the finance sheets yet."
      );
      if (body.written_to_gspread) setForm(blank);
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <form className="combo-form" onSubmit={submit}>
      <label>
        <span className="title-block-label">Type</span>
        <select value={form.type} onChange={set("type")}>
          <option>Revenue</option>
          <option>Cost</option>
        </select>
      </label>
      <label>
        <span className="title-block-label">Date</span>
        <input type="date" required value={form.date} onChange={set("date")} />
      </label>
      <label>
        <span className="title-block-label">Amount ($)</span>
        <input type="number" min="0.01" step="0.01" required value={form.amount} onChange={set("amount")} />
      </label>
      <label>
        <span className="title-block-label">Chapter</span>
        <select value={form.chapter} onChange={set("chapter")}>
          <option value={HQ}>HQ</option>
          {chapters.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="title-block-label">Category</span>
        <input required placeholder={form.type === "Revenue" ? "Donation, Grant…" : "Supplies, Software…"} value={form.category} onChange={set("category")} />
      </label>
      <label>
        <span className="title-block-label">{form.type === "Revenue" ? "From" : "Paid to"}</span>
        <input required value={form.source} onChange={set("source")} />
      </label>
      <label className="combo-form-wide">
        <span className="title-block-label">Notes</span>
        <input value={form.notes} onChange={set("notes")} />
      </label>
      <div className="combo-form-actions">
        <button type="submit" className="secondary-button">Add entry</button>
        <span className="combo-form-status" aria-live="polite">{status || "Shipping costs go in the master shipment sheet, not here."}</span>
      </div>
    </form>
  );
}

export default function Finance({ filters }) {
  const [tab, setTab] = useState("revenue");
  const fin = useFinance();
  const ships = useShipments();
  const rows = useMemo(() => filterFinance(fin.rows, filters), [fin.rows, filters]);

  if (fin.loading) return <Loading what="finance sheets" />;
  if (fin.error) return <ErrorText>{fin.error}</ErrorText>;

  const t = financeTotals(rows);
  const shippingCost = ships.rows
    .filter((s) => matchChapters(s.chapters, filters) && matchSemester(s, filters))
    .reduce((s, x) => s + (x.shipping_cost ?? 0), 0);
  const samples = Object.values(fin.origins).filter((o) => o.origin === "sample").map((o) => o.label);

  return (
    <div className="combo-stack">
      {samples.length > 0 && (
        <Notice>
          Showing <strong>made-up sample data</strong> for {samples.join(", ")}. Set the sheet links in Vercel to use the real sheets.
        </Notice>
      )}
      <MetricRow>
        <Metric label="Revenue" value={formatUsd(t.revenue)} />
        <Metric label="Cost" value={formatUsd(t.cost)} hint="Not counting shipping" />
        <Metric label="Net" value={formatUsd(t.net)} tone={t.net < 0 ? "bad" : undefined} hint={t.revenue ? `${formatPct(t.net / t.revenue)} margin` : undefined} />
        <Metric label="Shipping cost" value={formatUsd(shippingCost)} hint="From the master shipment sheet" />
      </MetricRow>
      <Subtabs
        tabs={[
          { id: "revenue", label: "Revenue" },
          { id: "cost", label: "Cost" },
          { id: "add", label: "Add an entry" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "add" ? (
        <Card title="Add an entry" subtitle="Goes straight into the Revenue or Expenses Google Sheet">
          <AddEntry chapters={chapterOptions(fin.rows.map((r) => r.entity))} />
        </Card>
      ) : (
        <FlowTab flow={tab} rows={rows} allRows={fin.rows} filters={filters} />
      )}
    </div>
  );
}

