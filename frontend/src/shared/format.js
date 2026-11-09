const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const missing = (n) => n == null || Number.isNaN(n);

export const formatUsd = (n) => (missing(n) ? "—" : usd.format(n));
export const formatNum = (n) => (missing(n) ? "—" : num.format(n));
export const formatPct = (n) => (missing(n) ? "—" : `${(n * 100).toFixed(1)}%`);

/** 1234 -> "$1.2k" */
export function formatUsdShort(n) {
  if (missing(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

/** "2026-03" -> "Mar 2026" */
export function formatMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}
