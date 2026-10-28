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

/*
 * Browser side of the scanner. Every read goes through the site relay (exact request shapes, see src/lib/relay.ts):
 * approval logs of one owner in block windows, then the current state of every pair in Multicall3 batches.
 * Nothing here signs or sends anything.
 */

const MAX_CHUNK = 10_000;
const MIN_CHUNK = 100;
const ZERO = "0x0000000000000000000000000000000000000000";

export type ScanProgress = { from: number; to: number; head: number; stop: number; chunk: number; events: number; queries: number };

/** Backward log scan for `owner` from `head` down to `stop`. Shrinks the window when the RPC refuses a range. */
export async function scanLogs(owner: string, head: number, stop: number, onProgress: (p: ScanProgress) => void, signal: { stopped: boolean }): Promise<{ events: ApprovalEvent[]; reached: number; error: string | null }> {
  const events: ApprovalEvent[] = [];
  const topic = padTopic(owner);
  let chunk = MAX_CHUNK;
  let to = head;
  let queries = 0;
  let error: string | null = null;
  while (to >= stop && !signal.stopped) {
    const from = Math.max(stop, to - chunk + 1);
    const range = { fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` };
    try {
      const res = await fetch("/api/rpc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify([
          { jsonrpc: "2.0", id: 0, method: "eth_getLogs", params: [{ ...range, topics: [[...TOKEN_TOPICS], topic] }] },
          { jsonrpc: "2.0", id: 1, method: "eth_getLogs", params: [{ ...range, address: PERMIT2, topics: [[...PERMIT2_TOPICS], topic] }] },
        ]),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => null)) as { id: number; result?: RawLog[]; error?: { message?: string } }[] | { error?: string } | null;
      if (!Array.isArray(body)) {
        error = (body && typeof body.error === "string" ? body.error : null) ?? `Relay answered ${res.status}`;
        if (res.status === 429) break;
        throw new Error(error);
      }
      const failed = body.find((b) => b.error || !Array.isArray(b.result));
      if (failed) {
        // The relay maps every upstream refusal to "read failed": treat it as a range problem first.
        if (chunk > MIN_CHUNK) {
          chunk = Math.max(MIN_CHUNK, Math.floor(chunk / 4));
          continue;
        }
        error = failed.error?.message ?? "The chain refused the log query.";
        break;
      }
      for (const b of body) for (const l of b.result ?? []) {
        const e = decodeLog(l, PERMIT2);
        if (e) events.push(e);
      }
      queries += 1;
      onProgress({ from, to, head, stop, chunk, events: events.length, queries });
      to = from - 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isRangeError(msg) && chunk > MIN_CHUNK) {
        chunk = Math.max(MIN_CHUNK, Math.floor(chunk / 4));
        continue;
      }
      error = msg;
      break;
    }
  }
  return { events, reached: Math.max(stop, to + 1), error };
}

type Call3 = { target: `0x${string}`; allowFailure: boolean; callData: `0x${string}` };
type Decoder = { abi: Abi; fn: string };

/** Runs reads through Multicall3 in batches; each entry is the decoded result or null when it failed. */
export async function multiRead(calls: (Call3 & Decoder)[]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let i = 0; i < calls.length; i += 100) {
    const chunk = calls.slice(i, i + 100);
    const data = encodeFunctionData({ abi: MULTICALL3_ABI, functionName: "aggregate3", args: [chunk.map(({ target, allowFailure, callData }) => ({ target, allowFailure, callData }))] });
    let results: readonly { success: boolean; returnData: `0x${string}` }[] = [];
    try {
      const raw = await rpcCall<`0x${string}`>("eth_call", [{ to: MULTICALL3, data }, "latest"]);
      results = decodeFunctionResult({ abi: MULTICALL3_ABI, functionName: "aggregate3", data: raw }) as never;
    } catch {
      results = [];
    }
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
  }
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
export async function readCurrent(owner: string, pairs: Pair[]): Promise<Map<string, Current>> {
  const res = await multiRead(pairs.map((p) => stateCall(owner, p)));
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
export async function tokenMeta(tokens: string[]): Promise<Map<string, TokenMeta>> {
  const uniq = [...new Set(tokens.map((t) => t.toLowerCase()))];
  const calls = uniq.flatMap((t) => [call(t, ERC20_ABI as Abi, "symbol", []), call(t, ERC20_ABI as Abi, "decimals", []), call(t, ERC20_ABI as Abi, "name", [])]);
  const res = await multiRead(calls);
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

/**
 * Quick check: for every listed token, the allowance to each known spender, plus each token's Permit2 allowance to the
 * known spenders. Finds open permissions of any age for common pairs, without logs. Returns only the open ones.
 */
export async function quickCheck(owner: string, tokens: string[], extraSpenders: string[] = []): Promise<Pair[]> {
  const spenders = [...new Set([...KNOWN_SPENDERS.map((s) => s.address), ...extraSpenders].map((s) => getAddress(s)))];
  const pairs: Pair[] = [];
  for (const t of tokens) {
    for (const s of spenders) pairs.push(barePair("erc20", t, s, "quick"));
    for (const s of spenders) if (s.toLowerCase() !== PERMIT2.toLowerCase()) pairs.push(barePair("permit2", t, s, "quick"));
  }
  const cur = await readCurrent(owner, pairs);
  const now = Math.floor(Date.now() / 1000);
  return pairs.filter((p) => {
    const c = cur.get(p.key);
    if (!c || c.unreadable || !c.amount) return false;
    if (p.kind === "permit2" && c.expiration && c.expiration < now) return false;
    return true;
  });
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
