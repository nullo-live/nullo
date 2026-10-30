import { decodeFunctionResult, encodeFunctionData, getAddress, type Abi } from "viem";
import { KNOWN_SPENDERS, MULTICALL3, PERMIT2 } from "@/config/brand";
import { CONTRACTS, labelsLive } from "@/config/contracts";
import { ERC20_ABI, LABELS_ABI, MULTICALL3_ABI, NFT_ABI, PERMIT2_ABI } from "@/lib/abi";
import {
  PERMIT2_TOPICS,
  TOKEN_TOPICS,
  barePair,
  decodeLog,
  isRangeError,
  padTopic,
  type ApprovalEvent,
  type Current,
  type Pair,
  type RawLog,
} from "@/lib/approvals";
import { rpcBatchLoose, rpcCall } from "@/lib/client";
import { coveredCount, gaps, mergeRanges, type Range } from "@/lib/coverage";

/*
 * Browser side of the scanner. Every read goes through the site relay (exact request shapes, see src/lib/relay.ts):
 * approval logs of one owner in block windows, then the current state of every pair in Multicall3 batches.
 * Nothing here signs or sends anything.
 */

/** Widest window: the official RPC's eth_getLogs limit and the relay's owner span. */
export const MAX_CHUNK = 30_000;
const MIN_CHUNK = 100;
/** Requests in flight at once during an event scan. */
export const SCAN_CONCURRENCY = 2;
const ZERO = "0x0000000000000000000000000000000000000000";
/** Token approvals and Permit2's own events of one owner, in one query (Permit2 events are told apart by emitter). */
const OWNER_TOPICS = [...TOKEN_TOPICS, ...PERMIT2_TOPICS];

export type ScanProgress = { lo: number; hi: number; covered: number; total: number; chunk: number; events: number; queries: number };
export type ScanResult = { events: ApprovalEvent[]; ranges: Range[]; skipped: Range[]; error: string | null; paused: boolean; queries: number };

/** Smallest windows still refused after this many are skipped in one scan, the scan stops (likely the endpoint, not the data). */
const MAX_SKIPPED = 20;

/** The answer for one log window: the logs, a refusal a smaller window may pass, or a reason to stop. */
export type WindowAnswer = { logs: RawLog[] } | { range: true; message: string } | { busy: true; message: string } | { fatal: string; paused?: boolean };

/** An upstream that is only busy (HTTP 429) or a fallback that refuses old logs: the same window may pass shortly. */
export const isBusyError = (m: string) => /\b429\b|too many requests|archive|personal token/i.test(m);
/** Reads approval logs of the owner topic in [from, to] with `topics`. */
export type WindowFetch = (topics: [string[], string], from: number, to: number) => Promise<WindowAnswer>;

/** One window through the site relay. */
export const relayWindow: WindowFetch = async (topics, from, to) => {
  const res = await fetch("/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 0, method: "eth_getLogs", params: [{ fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}`, topics }] }),
    cache: "no-store",
  }).catch((e: unknown) => ({ ok: false, status: 0, json: async () => ({ error: e instanceof Error ? e.message : String(e) }) }) as unknown as Response);
  const body = (await res.json().catch(() => null)) as { result?: RawLog[]; error?: { message?: string } | string } | null;
  if (res.status === 429) return { fatal: (typeof body?.error === "string" ? body.error : null) ?? "The relay budget for your network is used up for now.", paused: true };
  if (body && Array.isArray(body.result)) return { logs: body.result };
  const msg = typeof body?.error === "string" ? body.error : (body?.error?.message ?? `Relay answered ${res.status}`);
  if (isBusyError(msg)) return { busy: true, message: msg };
  // An upstream refusal of the range (or a timeout on a wide one) may pass in a smaller window.
  if (isRangeError(msg) || res.status === 502 || res.status === 0) return { range: true, message: msg };
  return { fatal: msg };
};

/**
 * Event scan of `owner` inside [lo, hi], skipping what `covered` already holds: windows of up to 30,000 blocks,
 * newest first, SCAN_CONCURRENCY in flight. A refused range shrinks the window (30k → 7.5k → … → 100); eight answers
 * in a row double it again. A window still refused at the smallest size is skipped (left uncovered, listed in
 * `skipped`) and the scan goes on with older blocks. Stops on the stop signal, a relay budget answer (paused: resume later) or another error. Every window that
 * answered is returned in `ranges`, so the caller can store it as the resumable cursor.
 */
export async function scanCoverage(
  owner: string,
  lo: number,
  hi: number,
  covered: Range[],
  onProgress: (p: ScanProgress) => void,
  signal: { stopped: boolean },
  opts: { fetchWindow?: WindowFetch; maxWindows?: number; concurrency?: number; deadline?: number } = {},
): Promise<ScanResult> {
  const fetchWindow = opts.fetchWindow ?? relayWindow;
  let budget = opts.maxWindows ?? Infinity;
  const topic = padTopic(owner);
  const events: ApprovalEvent[] = [];
  const done: Range[] = [];
  const skipped: Range[] = [];
  const queue: Range[] = gaps(covered, lo, hi);
  const total = Math.max(0, hi - lo + 1);
  let chunk = MAX_CHUNK;
  let streak = 0;
  let busyRun = 0;
  let queries = 0;
  let error: string | null = null;
  let paused = false;
  const report = () => onProgress({ lo, hi, covered: coveredCount([...covered, ...done], lo, hi), total, chunk, events: events.length, queries });
  /** Takes the newest window of at most `chunk` blocks off the queue. */
  const take = (): Range | null => {
    const g = queue.shift();
    if (!g) return null;
    const [a, b] = g;
    const from = Math.max(a, b - chunk + 1);
    if (from > a) queue.unshift([a, from - 1]);
    return [from, b];
  };
  const worker = async () => {
    while (!signal.stopped && !error && !paused && budget > 0 && (!opts.deadline || Date.now() < opts.deadline)) {
      const w = take();
      if (!w) return;
      budget -= 1;
      const r = await fetchWindow([OWNER_TOPICS, topic], w[0], w[1]);
      if ("logs" in r) {
        for (const l of r.logs) {
          const e = decodeLog(l, PERMIT2);
          if (e) events.push(e);
        }
        queries += 1;
        busyRun = 0;
        done.push(w);
        // A refusal can be one endpoint's bad moment: after a run of answers the window grows back.
        if (++streak >= 8 && chunk < MAX_CHUNK) {
          chunk = Math.min(MAX_CHUNK, chunk * 2);
          streak = 0;
        }
        report();
      } else if ("busy" in r) {
        // Wait and ask again; five busy answers in a row pause the scan (the cursor keeps what was read).
        if (++busyRun > 5) {
          error = `The chain's RPC is busy (${r.message.slice(0, 80)}).`;
          paused = true;
          return;
        }
        budget += 1;
        queue.unshift(w);
        await new Promise((res) => setTimeout(res, 600 * busyRun + Math.floor(Math.random() * 400)));
      } else if ("range" in r) {
        const width = w[1] - w[0] + 1;
        if (width <= MIN_CHUNK) {
          // Too many logs even in the smallest window (anyone can emit approvals naming this owner): leave it
          // uncovered and keep reading older blocks, so one crowded window cannot stop the whole scan.
          skipped.push(w);
          if (skipped.length > MAX_SKIPPED) {
            error = r.message;
            return;
          }
          continue;
        }
        chunk = Math.min(chunk, Math.max(MIN_CHUNK, Math.floor(width / 4)));
        streak = 0;
        budget += 1; // a refused window is read again, smaller
        queue.unshift(w);
      } else {
        error = r.fatal;
        paused = Boolean(r.paused);
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? SCAN_CONCURRENCY }, worker));
  return { events, ranges: mergeRanges(done), skipped: mergeRanges(skipped), error, paused, queries };
}

type Call3 = { target: `0x${string}`; allowFailure: boolean; callData: `0x${string}` };
type Decoder = { abi: Abi; fn: string };

/** Sends one Multicall3 aggregate3 call and returns the raw answer. The browser goes through the relay. */
export type MulticallExec = (data: `0x${string}`) => Promise<`0x${string}`>;
const relayExec: MulticallExec = (data) => rpcCall<`0x${string}`>("eth_call", [{ to: MULTICALL3, data }, "latest"]);

/** Inner calls per Multicall3 batch (the relay allows 120). */
export const MULTICALL_BATCH = 100;

/** Runs reads through Multicall3 in batches (two in flight); each entry is the decoded result or null when it failed. */
export async function multiRead(calls: (Call3 & Decoder)[], exec: MulticallExec = relayExec): Promise<unknown[]> {
  const chunks: (Call3 & Decoder)[][] = [];
  for (let i = 0; i < calls.length; i += MULTICALL_BATCH) chunks.push(calls.slice(i, i + MULTICALL_BATCH));
  const answers: (readonly { success: boolean; returnData: `0x${string}` }[])[] = new Array(chunks.length);
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const n = next++;
      const data = encodeFunctionData({ abi: MULTICALL3_ABI, functionName: "aggregate3", args: [chunks[n].map(({ target, allowFailure, callData }) => ({ target, allowFailure, callData }))] });
      try {
        answers[n] = decodeFunctionResult({ abi: MULTICALL3_ABI, functionName: "aggregate3", data: await exec(data) }) as never;
      } catch {
        answers[n] = [];
      }
    }
  };
  await Promise.all([worker(), worker()]);
  const out: unknown[] = [];
  chunks.forEach((chunk, n) => {
    const results = answers[n] ?? [];
    chunk.forEach((c, k) => {
      const r = results[k];
      if (!r || !r.success || r.returnData.length < 4) return out.push(null);
      try {
        const v = decodeFunctionResult({ abi: c.abi, functionName: c.fn, data: r.returnData } as never);
        out.push(v);
      } catch {
        out.push(null);
      }
    });
  });
  return out;
}

const call = (target: string, abi: Abi, fn: string, args: readonly unknown[]): Call3 & Decoder => ({
  target: target as `0x${string}`,
  allowFailure: true,
  callData: encodeFunctionData({ abi, functionName: fn, args } as never),
  abi,
  fn,
});

/** The read that tells whether a pair is still open. */
function stateCall(owner: string, p: Pair) {
  switch (p.kind) {
    case "erc20":
      return call(p.token, ERC20_ABI as Abi, "allowance", [owner, p.spender]);
    case "nft-all":
      return call(p.token, NFT_ABI as Abi, "isApprovedForAll", [owner, p.spender]);
    case "nft-one":
      return call(p.token, NFT_ABI as Abi, "getApproved", [p.tokenId ?? 0n]);
    case "permit2":
      return call(PERMIT2, PERMIT2_ABI as Abi, "allowance", [owner, p.token, p.spender]);
  }
}

/** Fresh state of every pair (keyed by pair key). */
export async function readCurrent(owner: string, pairs: Pair[], exec?: MulticallExec): Promise<Map<string, Current>> {
  const res = await multiRead(pairs.map((p) => stateCall(owner, p)), exec);
  const out = new Map<string, Current>();
  pairs.forEach((p, i) => {
    const v = res[i];
    if (v === null || v === undefined) return out.set(p.key, { amount: null, unreadable: true });
    if (p.kind === "erc20") return out.set(p.key, { amount: v as bigint, unreadable: false });
    if (p.kind === "nft-all") return out.set(p.key, { amount: v ? 1n : 0n, unreadable: false });
    if (p.kind === "nft-one") {
      const now = getAddress(v as string);
      const still = now.toLowerCase() === p.spender.toLowerCase() && now !== ZERO;
      return out.set(p.key, { amount: still ? 1n : 0n, approvedNow: now, unreadable: false });
    }
    const [amount, expiration] = v as readonly [bigint, number, number];
    out.set(p.key, { amount, expiration: Number(expiration), unreadable: false });
  });
  return out;
}

export type TokenMeta = { symbol: string | null; decimals: number | null; name: string | null };

/** Symbol, decimals and name of each token (null where the token does not answer). */
export async function tokenMeta(tokens: string[], exec?: MulticallExec): Promise<Map<string, TokenMeta>> {
  const uniq = [...new Set(tokens.map((t) => t.toLowerCase()))];
  const calls = uniq.flatMap((t) => [call(t, ERC20_ABI as Abi, "symbol", []), call(t, ERC20_ABI as Abi, "decimals", []), call(t, ERC20_ABI as Abi, "name", [])]);
  const res = await multiRead(calls, exec);
  const out = new Map<string, TokenMeta>();
  uniq.forEach((t, i) => {
    const [s, d, n] = res.slice(i * 3, i * 3 + 3);
    out.set(t, {
      symbol: typeof s === "string" ? s.slice(0, 24) : null,
      decimals: typeof d === "number" ? d : typeof d === "bigint" ? Number(d) : null,
      name: typeof n === "string" ? n.slice(0, 64) : null,
    });
  });
  return out;
}

/** Whether each address has contract code. */
export async function hasCode(addresses: string[]): Promise<Map<string, boolean | null>> {
  const uniq = [...new Set(addresses.map((a) => a.toLowerCase()))];
  const out = new Map<string, boolean | null>();
  for (let i = 0; i < uniq.length; i += 20) {
    const chunk = uniq.slice(i, i + 20);
    const raw = await rpcBatchLoose(chunk.map((a) => ({ method: "eth_getCode", params: [a, "latest"] }))).catch(() => chunk.map(() => null));
    chunk.forEach((a, k) => out.set(a, typeof raw[k] === "string" ? (raw[k] as string).length > 2 : null));
  }
  return out;
}

/** Unix time of each block (at most 60 distinct blocks are read; the rest stay unknown). */
export async function blockTimes(blocks: number[]): Promise<Map<number, number>> {
  const uniq = [...new Set(blocks)].sort((a, b) => b - a).slice(0, 60);
  const out = new Map<number, number>();
  for (let i = 0; i < uniq.length; i += 20) {
    const chunk = uniq.slice(i, i + 20);
    const raw = await rpcBatchLoose(chunk.map((b) => ({ method: "eth_getBlockByNumber", params: [`0x${b.toString(16)}`, false] }))).catch(() => chunk.map(() => null));
    chunk.forEach((b, k) => {
      const r = raw[k] as { timestamp?: string } | null;
      if (r?.timestamp) out.set(b, Number(BigInt(r.timestamp)));
    });
  }
  return out;
}

/** A token for the quick check; `curve` is its Pons bonding curve when it was launched on Pons V2. */
export type QuickToken = { address: string; curve?: string | null };

/**
 * Pairs the quick check reads: for every token, its allowance to each known spender, Permit2 allowance(owner, token,
 * spender) for the spenders that pull through Permit2 (plus any extra spender), and the allowance to the token's own
 * Pons curve. Repeated tokens and spenders are read once.
 */
export function quickPairs(tokens: QuickToken[], extraSpenders: string[] = []): Pair[] {
  const plain = [...new Set([...KNOWN_SPENDERS.map((s) => s.address), ...extraSpenders].map((s) => getAddress(s)))];
  const viaPermit2 = new Set([...KNOWN_SPENDERS.filter((s) => s.permit2).map((s) => s.address), ...extraSpenders].map((s) => s.toLowerCase()));
  const pairs = new Map<string, Pair>();
  const add = (p: Pair) => pairs.set(p.key, p);
  for (const t of tokens) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(t.address)) continue;
    for (const s of plain) add(barePair("erc20", t.address, s, "quick"));
    for (const s of plain) if (viaPermit2.has(s.toLowerCase()) && s.toLowerCase() !== PERMIT2.toLowerCase()) add(barePair("permit2", t.address, s, "quick"));
    if (t.curve && /^0x[0-9a-fA-F]{40}$/.test(t.curve) && !/^0x0{40}$/.test(t.curve)) add(barePair("erc20", t.address, t.curve, "quick"));
  }
  return [...pairs.values()];
}

/** Keeps the pairs that are open right now (expired Permit2 allowances are closed). */
export function openOnly(pairs: Pair[], cur: Map<string, Current>, nowSec: number): Pair[] {
  return pairs.filter((p) => {
    const c = cur.get(p.key);
    if (!c || c.unreadable || !c.amount) return false;
    if (p.kind === "permit2" && c.expiration && c.expiration < nowSec) return false;
    return true;
  });
}

/**
 * Quick check: reads every pair from quickPairs() at the latest block. Finds open permissions of any age for common
 * pairs, without logs. Returns only the open ones, with the state that was read.
 */
export async function quickCheck(owner: string, tokens: QuickToken[], extraSpenders: string[] = [], exec?: MulticallExec): Promise<{ open: Pair[]; current: Map<string, Current>; read: number }> {
  const pairs = quickPairs(tokens, extraSpenders);
  const cur = await readCurrent(owner, pairs, exec);
  return { open: openOnly(pairs, cur, Math.floor(Date.now() / 1000)), current: cur, read: pairs.length };
}

export type LabelFacts = { labels: number; flags: number; byReason: number[]; byCategory: number[] };

/** On-chain label and flag counts per spender (null when the labels contract is not deployed). */
export async function labelCounts(spenders: string[]): Promise<Map<string, LabelFacts> | null> {
  if (!labelsLive()) return null;
  const uniq = [...new Set(spenders.map((s) => s.toLowerCase()))];
  const res = await multiRead(uniq.map((s) => call(CONTRACTS.labels, LABELS_ABI as Abi, "countsOf", [s])));
  const out = new Map<string, LabelFacts>();
  uniq.forEach((s, i) => {
    const v = res[i] as readonly [number, number, readonly number[], readonly number[]] | null;
    if (v) out.set(s, { labels: Number(v[0]), flags: Number(v[1]), byCategory: v[2].map(Number), byReason: v[3].map(Number) });
  });
  return out;
}
