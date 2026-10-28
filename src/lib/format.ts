/** 709_571_103 -> "709.6M". */
export function compact(n: number) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export const usd = (n: number | null | undefined, digits = 2) =>
  n == null || !Number.isFinite(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export function ago(unixSeconds: number, now = Date.now() / 1000) {
  const d = Math.max(0, Math.floor(now - unixSeconds));
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export const bytesLabel = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

export const fmtInt = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "—");
export const fmtUsd = (n: number) => (Number.isFinite(n) ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—");
/** Token amount from base units (string) with decimals, whole tokens with separators. */
export function fmtSupply(raw: string | null, decimals: number | null) {
  if (!raw || decimals == null) return "—";
  try {
    const whole = BigInt(raw) / 10n ** BigInt(decimals);
    return whole.toLocaleString("en-US");
  } catch {
    return "—";
  }
}

/** 396_000 -> "396k", 48_812 -> "48.8k", 2_041 -> "2.0k", 564 -> "564". */
export function kfmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e5) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Age of an ISO date in words ("3h ago"); "—" for empty or invalid input. */
export function isoAgo(iso: string, now = Date.now()) {
  const t = Date.parse(iso);
  if (!iso || !Number.isFinite(t)) return "—";
  return ago(t / 1000, now / 1000);
}

/** Transfer amount: whole tokens with separators, "<1" for dust above zero. */
export function fmtAmount(raw: string, decimals: number) {
  try {
    const v = BigInt(raw);
    const whole = v / 10n ** BigInt(decimals);
    return whole === 0n && v > 0n ? "<1" : whole.toLocaleString("en-US");
  } catch {
    return "—";
  }
}
