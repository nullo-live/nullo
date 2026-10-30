import { pairKey, type ApprovalEvent, type Kind } from "@/lib/approvals";

/*
 * Block coverage of an event scan, free of I/O. The public RPC answers approval logs of one owner in windows of at
 * most 30,000 blocks, and the chain is past block 100M, so a whole-history scan takes thousands of windows. The
 * scanner therefore keeps a cursor: the block ranges already read (merged, inclusive) plus the events found in them.
 * A later scan only reads what is still missing, newest first, and the page shows covered vs not covered.
 */

/** Inclusive block range [from, to]. */
export type Range = [number, number];

/** Sorts and merges overlapping or touching ranges. */
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = ranges.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b >= a).map(([a, b]): Range => [a, b]).sort((x, y) => x[0] - y[0]);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/** Parts of [lo, hi] not inside `covered`, newest first. */
export function gaps(covered: Range[], lo: number, hi: number): Range[] {
  if (hi < lo) return [];
  const out: Range[] = [];
  let cursor = hi;
  for (const [a, b] of [...mergeRanges(covered)].reverse()) {
    if (a > cursor) continue;
    if (b < lo) break;
    if (b < cursor) out.push([Math.max(lo, b + 1), cursor]);
    cursor = a - 1;
    if (cursor < lo) break;
  }
  if (cursor >= lo) out.push([lo, cursor]);
  return out;
}

/** Blocks inside [lo, hi] that `covered` holds. */
export function coveredCount(covered: Range[], lo: number, hi: number): number {
  let n = 0;
  for (const [a, b] of mergeRanges(covered)) {
    const x = Math.max(a, lo);
    const y = Math.min(b, hi);
    if (y >= x) n += y - x + 1;
  }
  return n;
}

/**
 * Windows still to read inside [lo, hi], newest first, each at most `size` blocks, at most `maxWindows` of them.
 * Windows never cross a gap boundary, so every answer can be added to the cursor as is.
 */
export function planGaps(covered: Range[], lo: number, hi: number, size: number, maxWindows = Infinity): Range[] {
  const out: Range[] = [];
  if (size < 1) return out;
  for (const [a, b] of gaps(covered, lo, hi)) {
    for (let to = b; to >= a; to -= size) {
      if (out.length >= maxWindows) return out;
      out.push([Math.max(a, to - size + 1), to]);
    }
  }
  return out;
}

/** Plain-words summary of what was read inside [lo, hi]. */
export function describeCoverage(covered: Range[], lo: number, hi: number): { covered: number; total: number; percent: number; missing: Range[] } {
  const total = Math.max(0, hi - lo + 1);
  const c = coveredCount(covered, lo, hi);
  return { covered: c, total, percent: total ? Math.min(100, (c / total) * 100) : 100, missing: gaps(covered, lo, hi) };
}

/** Serialized cursor (bigints as decimal strings) for localStorage or a server cache. */
export type CursorJson = { v: 1; owner: string; ranges: Range[]; events: EventJson[]; at: number };
type EventJson = { k: Kind; t: string; s: string; a: string | null; p: boolean | null; i: string | null; e: number | null; b: number; x: string; l: number; d?: 1 };

export const MAX_CURSOR_EVENTS = 3000;

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const KINDS: Kind[] = ["erc20", "nft-all", "nft-one", "permit2"];

export function toCursor(owner: string, ranges: Range[], events: ApprovalEvent[], at = Date.now()): CursorJson {
  // Only the newest event of each pair decides its state, so older ones are dropped first.
  const latest = new Map<string, ApprovalEvent>();
  for (const e of events) {
    const k = pairKey(e);
    const p = latest.get(k);
    if (!p || e.block > p.block || (e.block === p.block && e.logIndex > p.logIndex)) latest.set(k, e);
  }
  const sorted = [...latest.values()].sort((x, y) => y.block - x.block || y.logIndex - x.logIndex);
  let kept = sorted;
  let merged = mergeRanges(ranges);
  if (sorted.length > MAX_CURSOR_EVENTS) {
    // Still too many pairs (anyone can emit approvals naming this owner from throwaway tokens): keep the newest pairs
    // and forget the blocks at and below the cut, so they are read again instead of hiding a pair that was dropped.
    const cut = sorted[MAX_CURSOR_EVENTS].block;
    kept = sorted.filter((e) => e.block > cut);
    merged = merged.filter(([, b]) => b > cut).map(([a, b]): Range => [Math.max(a, cut + 1), b]);
  }
  return {
    v: 1,
    owner: owner.toLowerCase(),
    ranges: merged,
    events: kept.map((e) => ({ k: e.kind, t: e.token, s: e.spender, a: e.amount === null ? null : e.amount.toString(), p: e.approved, i: e.tokenId === null ? null : e.tokenId.toString(), e: e.expiration, b: e.block, x: e.tx, l: e.logIndex, ...(e.lockdown ? { d: 1 as const } : {}) })),
    at,
  };
}

/** Reads a stored cursor back; null when it is missing, for another owner, or malformed in any field. */
export function fromCursor(raw: unknown, owner: string): { ranges: Range[]; events: ApprovalEvent[]; at: number } | null {
  const c = raw as CursorJson | null;
  if (!c || typeof c !== "object" || c.v !== 1 || typeof c.owner !== "string" || c.owner !== owner.toLowerCase()) return null;
  if (!Array.isArray(c.ranges) || !Array.isArray(c.events) || typeof c.at !== "number") return null;
  const ranges: Range[] = [];
  for (const r of c.ranges) {
    if (!Array.isArray(r) || r.length !== 2 || !Number.isSafeInteger(r[0]) || !Number.isSafeInteger(r[1]) || r[0] < 0 || r[1] < r[0]) return null;
    ranges.push([r[0], r[1]]);
  }
  const events: ApprovalEvent[] = [];
  const dec = (v: unknown) => (typeof v === "string" && /^\d{1,78}$/.test(v) ? BigInt(v) : null);
  for (const e of c.events.slice(0, MAX_CURSOR_EVENTS)) {
    if (!e || !KINDS.includes(e.k) || !ADDR.test(e.t) || !ADDR.test(e.s) || !Number.isSafeInteger(e.b) || !Number.isSafeInteger(e.l) || typeof e.x !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(e.x)) return null;
    events.push({ kind: e.k, token: e.t, spender: e.s, amount: dec(e.a), approved: typeof e.p === "boolean" ? e.p : null, tokenId: dec(e.i), expiration: typeof e.e === "number" ? e.e : null, block: e.b, tx: e.x, logIndex: e.l, ...(e.d ? { lockdown: true } : {}) });
  }
  return { ranges: mergeRanges(ranges), events, at: c.at };
}
