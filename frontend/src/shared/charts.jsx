// Hand-drawn SVG charts, like the rest of the operations dashboard (no chart library).
import { useEffect, useRef, useState } from "react";

/** Width of the element in px, so charts draw at their real size (text stays readable). */
export function useWidth(ready, fallback = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ready]);
  return [ref, width];
}
import { SERIES } from "./ui";

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p / 2) * 2 * p || p;
};

/**
 * Grouped vertical bars.
 * data:   [{ label, values: [n, n] }]
 * series: [{ name, color }]
 */
export function BarChart({ data, series, format = String, height = 240 }) {
  const [hover, setHover] = useState(null);
  const [ref, width] = useWidth(data.length > 0);
  if (!data.length) return <p className="combo-empty">Nothing to show for these filters.</p>;

  const W = Math.max(width, 480, data.length * 40);
  const H = height;
  const pad = { top: 12, right: 8, bottom: 34, left: 64 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.flatMap((d) => d.values)));
  const band = innerW / data.length;
  const barW = Math.min(26, (band * 0.7) / series.length);
  const y = (v) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <div className="combo-chart">
      <div className="combo-legend">
        {series.map((s, i) => (
          <span key={s.name}>
            <i style={{ background: s.color ?? SERIES[i] }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="combo-chart-scroll" ref={ref}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={series.map((s) => s.name).join(" and ") + " by period"}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="combo-grid" />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="combo-axis">
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = pad.left + i * band + (band - barW * series.length) / 2;
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={pad.left + i * band} y={pad.top} width={band} height={innerH} fill={hover === i ? "rgba(0,53,162,0.05)" : "transparent"} />
                {d.values.map((v, s) => (
                  <rect
                    key={s}
                    x={x0 + s * barW}
                    y={y(v)}
                    width={barW - 2}
                    height={Math.max(0, pad.top + innerH - y(v))}
                    rx="2"
                    fill={series[s].color ?? SERIES[s]}
                  />
                ))}
                <text x={pad.left + i * band + band / 2} y={H - 12} textAnchor="middle" className="combo-axis">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="combo-chart-readout" aria-live="polite">
        {hover == null
          ? "Hover a bar for exact numbers."
          : `${data[hover].label}: ` + series.map((s, i) => `${s.name} ${format(data[hover].values[i])}`).join(" · ")}
      </p>
    </div>
  );
}

/**
 * Line chart, one line per series, with a zero line when values go negative.
 * data:   [{ label, values: [n, n] }]
 * series: [{ name, color, dashed }]
 */
export function LineChart({ data, series, format = String, height = 210 }) {
  const [hover, setHover] = useState(null);
  const [ref, width] = useWidth(data.length > 0);
  if (!data.length) return <p className="combo-empty">Nothing to show for these filters.</p>;

  const W = Math.max(width, 420);
  const H = height;
  const pad = { top: 14, right: 16, bottom: 30, left: 64 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const all = data.flatMap((d) => d.values);
  const hi = niceMax(Math.max(0, ...all));
  const loRaw = Math.min(0, ...all);
  const lo = loRaw < 0 ? -niceMax(-loRaw) : 0;
  const y = (v) => pad.top + ((hi - v) / (hi - lo || 1)) * innerH;
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;
  const x = (i) => pad.left + (data.length > 1 ? i * step : innerW / 2);
  const ticks = lo < 0 ? [hi, hi / 2, 0, lo / 2, lo] : [0, 0.25, 0.5, 0.75, 1].map((t) => t * hi);
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 56)));

  return (
    <div className="combo-chart">
      <div className="combo-legend">
        {series.map((s, i) => (
          <span key={s.name}>
            <i style={{ background: s.color ?? SERIES[i] }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="combo-chart-scroll" ref={ref}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={series.map((s) => s.name).join(", ")}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className={t === 0 && lo < 0 ? "combo-zero" : "combo-grid"} />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="combo-axis">
                {format(t)}
              </text>
            </g>
          ))}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} className="combo-grid" />}
          {series.map((s, si) => (
            <g key={s.name}>
              <polyline
                fill="none"
                stroke={s.color ?? SERIES[si]}
                strokeWidth={s.dashed ? 1.5 : 2.5}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={data.map((d, i) => `${x(i)},${y(d.values[si])}`).join(" ")}
              />
              {data.map((d, i) => (
                <circle key={i} cx={x(i)} cy={y(d.values[si])} r={hover === i ? 4.5 : s.dashed ? 0 : 3} fill={s.color ?? SERIES[si]} />
              ))}
            </g>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 || i === data.length - 1 ? (
              <text key={d.label} x={x(i)} y={H - 10} textAnchor="middle" className="combo-axis">
                {d.label}
              </text>
            ) : null
          )}
          {data.map((d, i) => (
            <rect
              key={`hit-${d.label}`}
              x={x(i) - Math.max(step, 24) / 2}
              y={pad.top}
              width={Math.max(step, 24)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      </div>
      <p className="combo-chart-readout" aria-live="polite">
        {hover == null
          ? "Hover the chart for exact numbers."
          : `${data[hover].label}: ` + series.map((s, i) => `${s.name} ${format(data[hover].values[i])}`).join(" · ")}
      </p>
    </div>
  );
}

/** Horizontal share bars, largest first. items: [{ name, value }] */
export function ShareBars({ items, format = String, color = SERIES[0], limit = 8 }) {
  if (!items.length) return <p className="combo-empty">Nothing to show for these filters.</p>;
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((s, x) => s + x.value, 0);
  if (rest > 0) top.push({ name: "Other", value: rest });
  const total = sorted.reduce((s, x) => s + x.value, 0) || 1;
  const max = Math.max(...top.map((x) => x.value)) || 1;
  return (
    <ul className="combo-share">
      {top.map((x) => (
        <li key={x.name}>
          <span className="combo-share-name">{x.name}</span>
          <span className="combo-share-track">
            <span style={{ width: `${(x.value / max) * 100}%`, background: color }} />
          </span>
          <span className="combo-share-value">
            {format(x.value)} <small>{((x.value / total) * 100).toFixed(0)}%</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Revenue and cost bars per period with a net line on top (the finance
 * dashboard's "Monthly Revenue vs. Expense" chart).
 * data: [{ label, revenue, cost, net }]
 */
export function MoneyFlowChart({ data, colors, format = String, height = 300 }) {
  const [hover, setHover] = useState(null);
  const [ref, width] = useWidth(data.length > 0);
  if (!data.length) return <p className="combo-empty">Nothing to show for these filters.</p>;

  const W = Math.max(width, 480, data.length * 48);
  const H = height;
  const pad = { top: 14, right: 12, bottom: 34, left: 64 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const hi = niceMax(Math.max(0, ...data.flatMap((d) => [d.revenue, d.cost, d.net])));
  const loRaw = Math.min(0, ...data.map((d) => d.net));
  const lo = loRaw < 0 ? -niceMax(-loRaw) : 0;
  const y = (v) => pad.top + ((hi - v) / (hi - lo || 1)) * innerH;
  const band = innerW / data.length;
  const barW = Math.min(22, band * 0.32);
  const cx = (i) => pad.left + i * band + band / 2;
  const ticks = lo < 0 ? [hi, hi / 2, 0, lo] : [0, 0.25, 0.5, 0.75, 1].map((t) => t * hi);
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 60)));

  return (
    <div className="combo-chart">
      <div className="combo-legend">
        <span><i style={{ background: colors.revenue }} />Revenue</span>
        <span><i style={{ background: colors.cost }} />Expenses</span>
        <span><i style={{ background: colors.net }} />Net</span>
      </div>
      <div className="combo-chart-scroll" ref={ref}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Revenue, cost and net by period">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className={t === 0 && lo < 0 ? "combo-zero" : "combo-grid"} />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="combo-axis">{format(t)}</text>
            </g>
          ))}
          {data.map((d, i) => (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.left + i * band} y={pad.top} width={band} height={innerH} fill={hover === i ? "rgba(0,53,162,0.05)" : "transparent"} />
              <rect x={cx(i) - barW - 1} y={y(d.revenue)} width={barW} height={Math.max(0, y(0) - y(d.revenue))} rx="2" fill={colors.revenue} />
              <rect x={cx(i) + 1} y={y(d.cost)} width={barW} height={Math.max(0, y(0) - y(d.cost))} rx="2" fill={colors.cost} />
              {(i % labelEvery === 0 || i === data.length - 1) && (
                <text x={cx(i)} y={H - 12} textAnchor="middle" className="combo-axis">{d.label}</text>
              )}
            </g>
          ))}
          <polyline
            fill="none"
            stroke={colors.net}
            strokeWidth="2.5"
            strokeLinejoin="round"
            points={data.map((d, i) => `${cx(i)},${y(d.net)}`).join(" ")}
            pointerEvents="none"
          />
          {data.map((d, i) => (
            <circle key={i} cx={cx(i)} cy={y(d.net)} r={hover === i ? 4.5 : 3} fill={colors.net} pointerEvents="none" />
          ))}
        </svg>
      </div>
      <p className="combo-chart-readout" aria-live="polite">
        {hover == null
          ? "Hover a month for exact numbers."
          : `${data[hover].label}: revenue ${format(data[hover].revenue)} · cost ${format(data[hover].cost)} · net ${format(data[hover].net)}`}
      </p>
    </div>
  );
}

/** Donut of shares with a legend. items: [{ name, value }] */
export function Donut({ items, format = String, centerLabel = "Total", limit = 6 }) {
  const [hover, setHover] = useState(null);
  if (!items.length) return <p className="combo-empty">Nothing to show for these filters.</p>;
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((s, x) => s + x.value, 0);
  if (rest > 0) top.push({ name: "Other", value: rest });
  const total = top.reduce((s, x) => s + x.value, 0) || 1;
  const R = 70;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const active = hover != null ? top[hover] : null;

  return (
    <div className="combo-donut">
      <svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label={`${centerLabel} by share`}>
        <g transform="rotate(-90 90 90)">
          {top.map((x, i) => {
            const len = (x.value / total) * C;
            const seg = (
              <circle
                key={x.name}
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke={x.name === "Other" ? "#a9b3c8" : SERIES[i % SERIES.length]}
                strokeWidth={hover === i ? 26 : 22}
                strokeDasharray={`${Math.max(0, len - 2)} ${C}`}
                strokeDashoffset={-offset}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
            offset += len;
            return seg;
          })}
        </g>
        <text x="90" y="86" textAnchor="middle" className="combo-donut-value">{format(active ? active.value : total)}</text>
        <text x="90" y="104" textAnchor="middle" className="combo-axis">{active ? active.name : centerLabel}</text>
      </svg>
      <ul className="combo-donut-legend">
        {top.map((x, i) => (
          <li key={x.name} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={hover === i ? "active" : undefined}>
            <i style={{ background: x.name === "Other" ? "#a9b3c8" : SERIES[i % SERIES.length] }} />
            <span>{x.name}</span>
            <strong>{((x.value / total) * 100).toFixed(1)}%</strong>
            <small>{format(x.value)}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
