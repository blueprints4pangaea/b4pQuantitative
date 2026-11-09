// "Shipments by destination type": one bar per type with its count, value and
// poundage. Used beside the chapter breakdown on Operations, and on Home.
const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value ?? 0);

function formatCompactNumber(value, prefix = "") {
  const number = Number(value) || 0;
  if (Math.abs(number) < 10000) {
    return `${prefix}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(number)}`;
  }
  return `${prefix}${new Intl.NumberFormat("en-US", { notation: "compact", maximumSignificantDigits: 3 }).format(number)}`;
}

const formatWholeCurrency = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value ?? 0);

/**
 * types: [{ type, count, valuation, pounds }]
 * withTotals: show value and pounds under each bar (only when past shipments are loaded)
 */
export default function ShipmentMix({ types, withTotals = true, title = "Shipments by Destination Type" }) {
  const maxTypeCount = Math.max(...types.map((entry) => entry.count), 1);
  return (
    <div className="shipment-mix">
      <div className="donation-chart-header">
        <h3>{title}</h3>
      </div>
      <div className="shipment-mix-body type-bars">
        {types.map((entry) => (
          <div className="type-bar-column" key={entry.type}>
            <div className="type-bar-track">
              <div
                className={entry.count / maxTypeCount < 0.25 ? "type-bar is-short" : "type-bar"}
                style={{ height: `${Math.max((entry.count / maxTypeCount) * 100, 4)}%` }}
              >
                <span className="type-bar-count">{formatNumber(entry.count)}</span>
              </div>
            </div>
            <div className="type-bar-label">
              <strong>{entry.type}</strong>
              <span>{formatNumber(entry.count)} shipments</span>
              {withTotals ? (
                <span title={`${formatWholeCurrency(entry.valuation)} · ${formatNumber(Math.round(entry.pounds))} lbs`}>
                  {formatCompactNumber(entry.valuation, "$")} · {formatCompactNumber(entry.pounds)} lbs
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {withTotals ? (
        <p className="shipment-type-note">
          Includes past shipments from the Master Shipment Database. National shipments count as
          International.
        </p>
      ) : null}
    </div>
  );
}
