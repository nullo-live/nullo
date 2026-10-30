import "server-only";
import { knownSpenderName, PERMIT2 } from "@/config/brand";
import { decodeLog, isRangeError, mergePairs, pairsFrom, type ApprovalEvent, type Pair, type RawLog } from "@/lib/approvals";
import { buildAnswer, contiguousFrom, type ApiAnswer, type ApiCoverage } from "@/lib/approvals-api";
import { coveredCount, fromCursor, mergeRanges, toCursor, type Range } from "@/lib/coverage";
import { RpcError, rpc, rpcCapped } from "@/lib/feeds/rpc";
import { isBusyError, quickPairs, readCurrent, scanCoverage, tokenMeta, type WindowFetch } from "@/lib/scan";
import { blockscoutConfigured, ownerHistory } from "@/lib/server/blockscout";
import { serverExec } from "@/lib/server/chainread";
import { getStore } from "@/lib/server/store";
import { tokenList } from "@/lib/server/tokenlist";

/*
 * Server side of GET /api/approvals. For one owner it merges three reads, then reads the current state of every pair
 * through Multicall3 at the latest block and lists only what is open now:
 *   1. Blockscout whole-chain history when BLOCKSCOUT_API_KEY is set;
 *   2. otherwise owner-filtered log windows (30,000 blocks each, newest first) from the server RPC, continuing a
 *      cursor kept for 7 days, so every call reads a little further back (at most WINDOWS_PER_CALL windows);
 *   3. the quick check (listed tokens x confirmed spenders x Pons curves), which finds old approvals without logs.
 * Answers are cached for ANSWER_TTL seconds. Redis use is plain GET and SET EX on "nullo:" keys (the shared gateway
 * refuses scripts); without Redis the same caches live in this instance's memory.
 */

export const ANSWER_TTL = 120;
const CURSOR_TTL = 7 * 86_400;
const WINDOWS_PER_CALL = 8;
const SCAN_MS = 8_000;
const MAX_LOG_BYTES = 1_500_000;

const memAnswers = new Map<string, { until: number; value: Omit<ApiAnswer, "cached"> }>();
const memCursors = new Map<string, string>();
const inflight = new Map<string, Promise<Omit<ApiAnswer, "cached">>>();

const answerKey = (o: string) => `approvals:answer:v1:${o.toLowerCase()}`;
const cursorKey = (o: string) => `approvals:cursor:v1:${o.toLowerCase()}`;

async function cacheGet(key: string, mem: Map<string, string>): Promise<string | null> {
  const store = getStore();
  if (store) return store.get(key).catch(() => null);
  return mem.get(key) ?? null;
}
async function cacheSet(key: string, value: string, ttl: number, mem: Map<string, string>) {
  const store = getStore();
  if (store) return store.setEx(key, value, ttl).catch(() => undefined);
  if (mem.size > 2000) mem.clear();
  mem.set(key, value);
}

/** One owner window straight to the server RPC (endpoint fallback inside rpcCapped). */
const serverWindow: WindowFetch = async (topics, from, to) => {
  try {
    const logs = await rpcCapped<RawLog[]>("eth_getLogs", [{ fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}`, topics }], MAX_LOG_BYTES, () => new RpcError("too many logs in range", true));
    return Array.isArray(logs) ? { logs } : { range: true, message: "no answer" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isBusyError(msg)) return { busy: true, message: msg };
    return isRangeError(msg) || /abort|timeout|fetch failed|RPC 5/i.test(msg) ? { range: true, message: msg } : { fatal: msg };
  }
};

async function compute(owner: string): Promise<Omit<ApiAnswer, "cached">> {
  const notes: string[] = [];
  const head = Number(BigInt(await rpc<string>("eth_blockNumber", [])));
  const maps: Map<string, Pair>[] = [];
  let source: ApiCoverage["source"] = "quick";
  let ranges: Range[] = [];

  // 1 + 2: events.
  if (blockscoutConfigured()) {
    try {
      const h = await ownerHistory(owner);
      const evs = h.logs.map((l) => decodeLog(l, PERMIT2)).filter((e): e is ApprovalEvent => Boolean(e));
      maps.push(pairsFrom(evs, "explorer"));
      source = "blockscout";
      ranges = [[1, head]];
      if (h.capped) notes.push("Explorer history returned its first pages only; very old events may be missing.");
    } catch {
      notes.push("Explorer history did not answer; owner log windows were read instead.");
    }
  }
  if (source !== "blockscout") {
    const prev = fromCursor(JSON.parse((await cacheGet(cursorKey(owner), memCursors)) ?? "null"), owner);
    const covered = prev?.ranges ?? [];
    const scan = await scanCoverage(owner, 1, head, covered, () => undefined, { stopped: false }, { fetchWindow: serverWindow, maxWindows: WINDOWS_PER_CALL, concurrency: 3, deadline: Date.now() + SCAN_MS });
    const events = [...(prev?.events ?? []), ...scan.events];
    ranges = mergeRanges([...covered, ...scan.ranges]);
    if (scan.error) notes.push(`Log windows stopped early: ${scan.error.slice(0, 160)}`);
    if (ranges.length) {
      source = "rpc";
      await cacheSet(cursorKey(owner), JSON.stringify(toCursor(owner, ranges, events)), CURSOR_TTL, memCursors);
    }
    maps.push(pairsFrom(events, "logs"));
  }

  // 3: quick check.
  const tl = await tokenList();
  if (/fixed tokens only/.test(tl.source)) notes.push("The traded-token list did not load this time; the known-spender check read the fixed tokens only.");
  const tokens = tl.list.map((t) => ({ address: t.address, curve: t.curve ?? null }));
  const quick = quickPairs(tokens);
  maps.push(new Map(quick.map((p) => [p.key, p])));

  const pairs = [...mergePairs(...maps).values()];
  const current = await readCurrent(owner, pairs, serverExec);
  const symbols = new Map<string, string | null>(tl.list.map((t) => [t.address.toLowerCase(), t.symbol]));
  const curves = new Map<string, string>();
  for (const t of tl.list) if (t.curve) curves.set(t.curve.toLowerCase(), t.symbol);
  const unknown = [...new Set(pairs.filter((p) => current.get(p.key)?.amount).map((p) => p.token.toLowerCase()))].filter((t) => !symbols.has(t));
  if (unknown.length) for (const [t, m] of await tokenMeta(unknown, serverExec)) symbols.set(t, m.symbol);
  if (source === "rpc" && coveredCount(ranges, 1, head) < head) notes.push("Older blocks are not read yet without an explorer key: call again later to read further back, or check pairs by hand.");

  return buildAnswer({
    owner,
    pairs,
    current,
    symbols,
    label: (s) => knownSpenderName(s, curves),
    coverage: {
      fromBlock: source === "blockscout" ? 1 : contiguousFrom(ranges, head),
      toBlock: head,
      source,
      ranges: ranges.slice(-50),
      missingBlocks: Math.max(0, head - coveredCount(ranges, 1, head)),
      quickCheck: { tokens: tokens.length, pairs: quick.length },
      notes,
    },
    nowSec: Math.floor(Date.now() / 1000),
  });
}

/** The answer for `owner` (checksummed), from the cache when it is younger than ANSWER_TTL. */
export async function ownerApprovals(owner: string): Promise<ApiAnswer> {
  const k = answerKey(owner);
  const store = getStore();
  if (store) {
    const hit = await store.get(k).catch(() => null);
    if (hit) {
      try {
        return { ...(JSON.parse(hit) as Omit<ApiAnswer, "cached">), cached: true };
      } catch {
        // a damaged entry is recomputed
      }
    }
  } else {
    const m = memAnswers.get(k);
    if (m && m.until > Date.now()) return { ...m.value, cached: true };
  }
  let p = inflight.get(k);
  if (!p) {
    p = compute(owner).finally(() => inflight.delete(k));
    inflight.set(k, p);
  }
  const value = await p;
  if (store) await store.setEx(k, JSON.stringify(value), ANSWER_TTL).catch(() => undefined);
  else {
    if (memAnswers.size > 1000) memAnswers.clear();
    memAnswers.set(k, { until: Date.now() + ANSWER_TTL * 1000, value });
  }
  return { ...value, cached: false };
}
