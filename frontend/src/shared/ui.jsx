// Small building blocks shared by Home, Finance, Operations and Expansion.
// They reuse the operations dashboard's classes (summary-card, panel-header,
// metric-card, shipment-subtab, shipment-kpi-table) so every tab looks the same.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Categorical colors from the operations dashboard's chart palette.
export const SERIES = ["#0069f3", "#f0643c", "#12a58a", "#e29b00", "#d9609e", "#5a4fcf"];
export const REVENUE_COLOR = SERIES[0];
export const COST_COLOR = SERIES[1];

export function Card({ label, title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`summary-card combo-card ${className}`}>
      {(title || label || actions) && (
        <div className="panel-header">
          <div>
            {label && <p className="section-label">{label}</p>}
            {title && <h3>{title}</h3>}
            {subtitle && <p className="combo-subtitle">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Metric({ label, value, hint, tone, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`metric-card combo-metric${tone ? ` combo-metric-${tone}` : ""}${onClick ? " combo-metric-link" : ""}`}
      onClick={onClick}
    >
      <p className="metric-label">{label}</p>
      <p className="metric-value metric-value-compact">{value}</p>
      {hint && <p className="combo-metric-hint">{hint}</p>}
    </Tag>
  );
}

export function MetricRow({ children }) {
  return <div className="combo-metric-row">{children}</div>;
}

export function Subtabs({ tabs, value, onChange }) {
  return (
    <div className="shipment-subtabs combo-subtabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          className={t.id === value ? "shipment-subtab active" : "shipment-subtab"}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Notice({ children }) {
  return <p className="combo-notice">{children}</p>;
}

export function Loading({ what }) {
  return <p className="combo-loading">Loading {what}…</p>;
}

export function ErrorText({ children }) {
  return <div className="panel error-panel">{children}</div>;
}

/** Plain table in the ops table style. columns: [{key, label, align, render}] */
export function Table({ columns, rows, rowKey, empty = "Nothing to show for these filters.", highlight }) {
  if (!rows.length) return <p className="combo-empty">{empty}</p>;
  return (
    <div className="combo-table-wrap">
      <table className="shipment-kpi-table combo-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === "right" ? "num" : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r) : i} className={highlight?.(r) ? "combo-row-highlight" : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === "right" ? "num" : undefined}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Puts its children in the page header, under the title (the slot lives in Shell). */
export function HeaderStatus({ children }) {
  const [slot, setSlot] = useState(null);
  useEffect(() => setSlot(document.getElementById("combo-header-status")), []);
  return slot ? createPortal(children, slot) : null;
}
