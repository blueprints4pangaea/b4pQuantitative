// Chapter operations: shipments from the master shipment sheet, filterable by
// chapter and semester. Shipments that only appear in a chapter's own Shipment
// History doc are listed separately below, so nothing is counted twice.
import { useMemo } from "react";
import { useApi } from "../shared/api";
import { BarChart, ShareBars } from "../shared/charts";
import { canonicalChapter } from "../shared/chapters";
import { describeFilters, matchChapters, matchSemester, useShipments } from "../shared/data";
import { formatNum, formatUsd, formatUsdShort } from "../shared/format";
import { semesterOfDate } from "../shared/semester";
import { COST_COLOR, Card, ErrorText, Loading, Metric, MetricRow, REVENUE_COLOR, Table } from "../shared/ui";

const add = (rows, key) => rows.reduce((s, r) => s + (r[key] ?? 0), 0);

export function filterShipments(rows, filters) {
  return rows.filter((s) => matchChapters(s.chapters, filters) && matchSemester(s, filters));
}

/** A shipment listed under several chapters splits its numbers evenly, as on the Shipment KPIs tab. */
function byChapter(rows) {
  const m = new Map();
  for (const s of rows) {
    const n = s.chapters.length || 1;
    for (const name of s.chapters.length ? s.chapters : ["No chapter listed"]) {
      const b = m.get(name) ?? { name, shipments: 0, valuation: 0, pounds: 0, cost: 0 };
      b.shipments += 1;
      b.valuation += (s.valuation ?? 0) / n;
      b.pounds += (s.pounds ?? 0) / n;
      b.cost += (s.shipping_cost ?? 0) / n;
      m.set(name, b);
    }
  }
  return [...m.values()].sort((a, b) => b.valuation - a.valuation);
}

function ChapterDocShipments({ filters }) {
  const res = useApi("/chapter-shipments");
  const rows = useMemo(
    () =>
      (res.data?.schools ?? []).flatMap((school) =>
        school.shipments.map((s) => ({ ...s, chapter: canonicalChapter(school.name), semester: semesterOfDate(s.date) }))
      ),
    [res.data]
  );
  if (res.loading) return <Loading what="chapter shipment docs" />;
  if (res.error) return <p className="combo-empty">{res.error}</p>;
  const mine = rows.filter((r) => matchChapters([r.chapter], filters) && matchSemester(r, filters));
  return (
    <Table
      columns={[
        { key: "date", label: "Date" },
        { key: "chapter", label: "Chapter" },
        { key: "name", label: "Shipment" },
        { key: "recipients", label: "Recipients", render: (r) => r.recipients.join(", ") },
        { key: "units", label: "Units", align: "right", render: (r) => formatNum(r.units) },
        { key: "cost", label: "Supply value", align: "right", render: (r) => formatUsd(r.cost) },
      ]}
      rows={[...mine].sort((a, b) => b.date.localeCompare(a.date))}
      empty="No chapter-doc shipments for these filters."
    />
  );
}

export default function ChapterOps({ filters }) {
  const ships = useShipments();
  const rows = useMemo(() => filterShipments(ships.rows, filters), [ships.rows, filters]);

  if (ships.loading) return <Loading what="the master shipment sheet" />;
  if (ships.error) return <ErrorText>{ships.error}</ErrorText>;

  const years = [...new Set(rows.map((r) => r.year))].sort();
  const chart = years.map((y) => {
    const inYear = rows.filter((r) => r.year === y);
    return { label: String(y), values: [add(inYear, "valuation"), add(inYear, "shipping_cost")] };
  });
  const destinations = new Map();
  for (const r of rows) {
    const d = r.destination || "Not recorded";
    destinations.set(d, (destinations.get(d) ?? 0) + 1);
  }

  return (
    <div className="combo-stack">
      <MetricRow>
        <Metric label="Shipments" value={formatNum(rows.length)} />
        <Metric label="Value of supplies shipped" value={formatUsd(add(rows, "valuation"))} />
        <Metric label="Weight shipped" value={`${formatNum(add(rows, "pounds"))} lbs`} />
        <Metric label="Shipping cost" value={formatUsd(add(rows, "shipping_cost"))} />
      </MetricRow>

      <Card title="Value shipped and shipping cost by year" subtitle={`${describeFilters(filters)} · master shipment sheet`}>
        <BarChart
          data={chart}
          series={[
            { name: "Value of supplies", color: REVENUE_COLOR },
            { name: "Shipping cost", color: COST_COLOR },
          ]}
          format={formatUsdShort}
        />
      </Card>

      <div className="combo-two-col">
        <Card title="By chapter" subtitle="A shipment with several chapters splits its numbers evenly">
          <Table
            columns={[
              { key: "name", label: "Chapter" },
              { key: "shipments", label: "Shipments", align: "right" },
              { key: "valuation", label: "Value", align: "right", render: (r) => formatUsd(r.valuation) },
              { key: "cost", label: "Shipping", align: "right", render: (r) => formatUsd(r.cost) },
            ]}
            rows={byChapter(rows)}
            rowKey={(r) => r.name}
            highlight={(r) => r.name === filters.chapter}
          />
        </Card>
        <Card title="Destinations" subtitle="Number of shipments">
          <ShareBars items={[...destinations].map(([name, value]) => ({ name, value }))} format={formatNum} />
        </Card>
      </div>

      <Card title="Shipments" subtitle="Newest first, from the master shipment sheet">
        <Table
          columns={[
            { key: "date_label", label: "Date" },
            { key: "chapter", label: "Chapter", render: (r) => r.chapters.join(", ") || "—" },
            { key: "destination", label: "Destination" },
            { key: "recipient", label: "Recipient" },
            { key: "type_label", label: "Type" },
            { key: "valuation", label: "Value", align: "right", render: (r) => formatUsd(r.valuation) },
            { key: "shipping_cost", label: "Shipping", align: "right", render: (r) => formatUsd(r.shipping_cost) },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
        />
      </Card>

      <Card title="Shipments from chapter docs" subtitle="Hand-copied from each chapter's Shipment History doc. Some of these aren't in the master sheet yet, so they're listed here and not added to the totals above.">
        <ChapterDocShipments filters={filters} />
      </Card>
    </div>
  );
}
