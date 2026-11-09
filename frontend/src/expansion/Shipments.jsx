import { useEffect, useMemo, useState } from "react";
import "./Shipments.css";

const MISSING = "–";

function money(value) {
  if (value == null) return MISSING;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 1000 ? 0 : 2 });
}

function count(value) {
  return value == null ? MISSING : value.toLocaleString("en-US");
}

function shipmentsLabel(n) {
  return `${n} shipment${n === 1 ? "" : "s"}`;
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function shortMoney(t) {
  return t >= 1000 ? `$${t / 1000}K` : `$${t}`;
}

// --- bar chart: total value of each shipment ---

const W = 640;
const H = 280;
const PAD = { top: 22, right: 16, bottom: 56, left: 54 };

function niceMax(max) {
  const pow = 10 ** Math.floor(Math.log10(max || 1));
  return Math.ceil((max || 1) / pow) * pow;
}

function CostChart({ shipments }) {
  const [hover, setHover] = useState(null);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const top = niceMax(Math.max(...shipments.map((s) => s.cost)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);
  const slot = plotW / shipments.length;
  const barW = Math.min(64, slot * 0.6);
  const y = (v) => PAD.top + plotH * (1 - v / top);
  const hovered = hover == null ? null : shipments[hover];

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Total value of each shipment" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
              {shortMoney(t)}
            </text>
          </g>
        ))}

        {shipments.map((s, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          return (
            <g key={s.name} onMouseEnter={() => setHover(i)}>
              <rect x={cx - slot / 2} y={PAD.top} width={slot} height={plotH} fill="transparent" />
              <rect className="bar" x={cx - barW / 2} y={y(s.cost)} width={barW} height={y(0) - y(s.cost)} rx="6" />
              <text className="point-label" x={cx} y={y(s.cost) - 8} textAnchor="middle">
                {money(s.cost)}
              </text>
              <text className="tick x" x={cx} y={H - 30} textAnchor="middle">
                {s.name.length > 14 ? `${s.name.slice(0, 13)}…` : s.name}
              </text>
              <text className="tick" x={cx} y={H - 12} textAnchor="middle">
                {formatDate(s.date)}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div className="chart-tooltip">
          <strong>{hovered.name}</strong>
          <span>
            {money(hovered.cost)} · {count(hovered.units)} units
          </span>
        </div>
      )}
    </div>
  );
}

// --- donut: share of what was shipped, by material ---

const SLICE_COLORS = ["#0035a2", "#0069f3", "#6ea2ff", "#14a38b", "#f0a030", "#b9c1d8", "#d4547a"];
const R = 92;
const R_INNER = 56;

function arcPath(start, end) {
  //full circle can't be one arc, so nudge it
  const sweep = Math.min(end - start, Math.PI * 2 - 0.0001);
  const e = start + sweep;
  const pt = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
  const [x1, y1] = pt(R, start);
  const [x2, y2] = pt(R, e);
  const [x3, y3] = pt(R_INNER, e);
  const [x4, y4] = pt(R_INNER, start);
  const large = sweep > Math.PI ? 1 : 0;
  return `M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${R_INNER},${R_INNER} 0 ${large} 0 ${x4},${y4} Z`;
}

function percent(share) {
  const p = share * 100;
  return p < 1 ? "<1%" : `${p.toFixed(p < 10 ? 1 : 0)}%`;
}

function MaterialsDonut({ shipments, categories }) {
  const [measure, setMeasure] = useState("units");
  const [hover, setHover] = useState(null);

  const slices = useMemo(() => {
    const totals = Object.fromEntries(categories.map((c) => [c, 0]));
    shipments.forEach((s) => s.items.forEach((i) => (totals[i.category] += measure === "units" ? i.units : i.cost)));
    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, share: value / sum, color: SLICE_COLORS[i % SLICE_COLORS.length] }));
  }, [shipments, categories, measure]);

  let angle = -Math.PI / 2;
  const arcs = slices.map((s) => {
    const start = angle;
    angle += s.share * Math.PI * 2;
    return { ...s, start, end: angle };
  });
  const active = hover == null ? null : arcs[hover];
  const fmt = (v) => (measure === "units" ? `${count(v)} units` : money(v));

  return (
    <div className="donut-card">
      <div className="donut-controls">
        <div className="segmented">
          {["units", "cost"].map((m) => (
            <button key={m} type="button" className={measure === m ? "active" : ""} onClick={() => setMeasure(m)}>
              {m === "units" ? "By units" : "By value"}
            </button>
          ))}
        </div>
      </div>

      <div className="donut-body">
        <svg viewBox="-110 -110 220 220" role="img" aria-label="Share of shipments by material" onMouseLeave={() => setHover(null)}>
          {arcs.map((a, i) => (
            <path
              key={a.label}
              d={arcPath(a.start, a.end)}
              fill={a.color}
              className={hover != null && hover !== i ? "slice dim" : "slice"}
              onMouseEnter={() => setHover(i)}
            />
          ))}
          <text className="donut-big" y="-2" textAnchor="middle">
            {active ? percent(active.share) : measure === "units" ? "Units" : "Value"}
          </text>
          <text className="donut-small" y="18" textAnchor="middle">
            {active ? active.label.split(" (")[0] : "by material"}
          </text>
        </svg>

        <ul className="donut-legend">
          {arcs.map((a, i) => (
            <li key={a.label} className={hover === i ? "on" : ""} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <i style={{ background: a.color }} />
              <span className="name">{a.label}</span>
              <b>{percent(a.share)}</b>
              <small>{fmt(a.value)}</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Recipients({ recipients }) {
  return (
    <ul className="recipient-list">
      {recipients.map((r) => (
        <li key={r.name}>
          <strong>{r.name}</strong>
          <span>{r.shipments.join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

function readSchoolFromUrl() {
  return new URLSearchParams(window.location.search).get("school");
}

export default function Shipments({ apiBase }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(readSchoolFromUrl);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/chapter-shipments`)
      .then((res) => {
        if (!res.ok) throw new Error(`Shipments could not be loaded (${res.status}).`);
        return res.json();
      })
      .then((json) => !cancelled && setData(json))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="loading">Loading shipments…</p>;

  const school = data.schools.find((x) => x.name === picked) ?? data.schools.find((x) => x.name === data.defaultSchool) ?? data.schools[0];
  const { shipments, summary, recipients } = school;
  const weight = summary.weightLbs;

  const pickSchool = (name) => {
    setPicked(name);
    const url = new URL(window.location.href);
    if (name === data.defaultSchool) url.searchParams.delete("school");
    else url.searchParams.set("school", name);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="shipments">
      <div className="school-bar">
        <span className="eyebrow">School</span>
        <div className="segmented" role="tablist" aria-label="School">
          {data.schools.map((x) => (
            <button key={x.name} type="button" role="tab" aria-selected={x.name === school.name} className={x.name === school.name ? "active" : ""} onClick={() => pickSchool(x.name)}>
              {x.name}
            </button>
          ))}
        </div>
      </div>

      <div className="shipments-top">
        <div>
          <span className="eyebrow">Shipments tracked</span>
          <div className="hero-row">
            <span className="hero-value">{summary.shipments}</span>
          </div>
          <p className="hero-sub">
            {school.name}, {summary.years.join(" and ")}.
          </p>
        </div>

        <div className="stat-tiles">
          <div className="stat-tile">
            <span className="eyebrow">Recipients served</span>
            <strong>{summary.recipientsServed}</strong>
            <small>organizations</small>
          </div>
          <div className="stat-tile">
            <span className="eyebrow">Total value</span>
            <strong>{money(summary.cost)}</strong>
            <small>{summary.shipments === 1 ? "1 shipment" : `all ${summary.shipments} shipments`}</small>
          </div>
          <div className="stat-tile">
            <span className="eyebrow">Units shipped</span>
            <strong>{count(summary.units)}</strong>
            <small>from the line items</small>
          </div>
          <div className="stat-tile">
            <span className="eyebrow">Weight</span>
            <strong>{weight.known ? `${weight.total.toLocaleString("en-US")} lbs` : MISSING}</strong>
            <small>{weight.missing ? `${weight.known} of ${shipmentsLabel(summary.shipments)}` : summary.shipments === 1 ? "1 shipment" : `all ${summary.shipments} shipments`}</small>
          </div>
        </div>
      </div>

      <div className="shipments-grid">
        <section className="card">
          <div className="card-head">
            <h3>Total value of each shipment</h3>
            <p>Hover a bar for details.</p>
          </div>
          <CostChart shipments={shipments} />
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Who we shipped to</h3>
            <p>Recipients served by {school.name}.</p>
          </div>
          <Recipients recipients={recipients} />
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>What we're shipping</h3>
          <p>Share of everything shipped, by type of material. Hover a slice or a row.</p>
        </div>
        <MaterialsDonut key={school.name} shipments={shipments} categories={data.categories} />
      </section>

      <section className="card">
        <div className="card-head">
          <h3>All shipments</h3>
          <p>Oldest first. Open a row to see its line items.</p>
        </div>
        <div className="table-wrap">
          <table className="ship-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Shipment</th>
                <th>Recipients</th>
                <th className="num">Units</th>
                <th className="num">Weight (lbs)</th>
                <th className="num">Total value</th>
              </tr>
            </thead>
            {shipments.map((s) => (
              <tbody key={s.name}>
                <tr>
                  <td>{formatDate(s.date)}</td>
                  <td>
                    <strong>{s.name}</strong>
                    {s.note && <small>{s.note}</small>}
                  </td>
                  <td>{s.recipients.join(", ")}</td>
                  <td className="num">{count(s.units)}</td>
                  <td className="num">{s.weightLbs == null ? MISSING : s.weightLbs.toFixed(2)}</td>
                  <td className="num">{money(s.cost)}</td>
                </tr>
                <tr className="items-row">
                  <td colSpan="6">
                    <details>
                      <summary>{s.items.length} line items</summary>
                      <table className="items-table">
                        <tbody>
                          {s.items.map((i, k) => (
                            <tr key={k}>
                              <td>{i.name}</td>
                              <td>{i.company}</td>
                              <td>{i.category}</td>
                              <td className="num">{count(i.units)}</td>
                              <td className="num">{money(i.cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </td>
                </tr>
              </tbody>
            ))}
          </table>
        </div>
      </section>
    </div>
  );
}
