const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatUsd(value: number, { whole = false } = {}) {
  return (whole ? usdWhole : usd).format(value);
}

export function formatPrice(value: number) {
  if (value === 0) return "$0";
  if (Math.abs(value) < 0.01) return `$${value.toPrecision(3)}`;
  return usd.format(value);
}

export function formatAmount(value: number) {
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs < 0.0001) return value.toExponential(2);
  if (abs >= 1e12) return value.toExponential(3);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function timeAgo(iso: string, now: number) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
