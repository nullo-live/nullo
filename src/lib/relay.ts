import { decodeFunctionData, toEventSelector } from "viem";
import { BRAND, ETH_USD_FEED, MULTICALL3, PERMIT2, USDG, WETH, isAddress } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";
import { MULTICALL3_ABI } from "@/lib/abi";
import { PERMIT2_TOPICS, TOKEN_TOPICS } from "@/lib/approvals";

/*
 * Rules for the read-only JSON-RPC relay, kept apart from the route so they can be tested. Every request is priced
 * in units; each network has a budget and the whole site has a ceiling. Only the exact request shapes the site
 * itself issues pass:
 *   - eth_call to the contracts the site reads (stablecoin, WETH, price feed, the token, NulloSpenderLabels,
 *     Multicall3, Permit2), or to ANY address when the call is one of a few token read functions (allowance,
 *     isApprovedForAll, getApproved, symbol, decimals, name, balanceOf, totalSupply, supportsInterface) with a low gas cap;
 *   - Multicall3 aggregate3 only when every inner call is such a read;
 *   - eth_getLogs in three shapes: approval events of one owner (no address, topics [token approval and/or Permit2
 *     events, owner]), Permit2 events of one owner (address Permit2, topics [Permit2 events, owner]), and
 *     NulloSpenderLabels events.
 * Owner-filtered log queries are index lookups on the node, so they are priced by 5,000-block steps and may span
 * the public RPC's own limit (30,000 blocks); three of them fit in one batch.
 */

export const MAX_CALLS = 20;
export const MAX_LOGS_PER_BATCH = 3;
/** Widest single approval query: the official RPC's own eth_getLogs limit (checked 30 Oct 2026). */
export const MAX_OWNER_LOG_SPAN = 30_000;
/** Widest single query on the labels contract. */
export const MAX_LABEL_LOG_SPAN = 20_000;
/** Total blocks one batch may cover (three owner windows). */
export const MAX_BATCH_SPAN = 90_000;
/** Owner and Permit2 log queries are priced per this many blocks. */
export const OWNER_LOG_STEP = 5_000;
/** Inner calls of one Multicall3 batch that cost one unit. */
export const MULTICALL_CALLS_PER_UNIT = 20;
export const MAX_GAS = 5_000_000;
/** Gas cap for a token read sent to an address the site does not know. */
export const MAX_FOREIGN_GAS = 200_000;
/** Most inner calls in one Multicall3 batch. */
export const MAX_MULTICALL = 120;

const GAS_CAP_HEX = `0x${MAX_GAS.toString(16)}`;
const FOREIGN_GAS_HEX = `0x${MAX_FOREIGN_GAS.toString(16)}`;
const CALL_KEYS = new Set(["from", "to", "gas", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "value", "data", "input", "nonce", "type", "chainId"]);
const LOG_KEYS = new Set(["address", "fromBlock", "toBlock", "topics", "blockHash"]);
const BLOCK_TAG = /^(latest|pending|safe|finalized|0x[0-9a-fA-F]{1,16})$/;

/** Token read functions any address may answer: selector => largest call data in hex characters. */
export const READ_SELECTORS: Record<string, number> = {
  "0xdd62ed3e": 2 + 8 + 128, // allowance(address,address)
  "0xe985e9c5": 2 + 8 + 128, // isApprovedForAll(address,address)
  "0x081812fc": 2 + 8 + 64, // getApproved(uint256)
  "0x95d89b41": 2 + 8, // symbol()
  "0x313ce567": 2 + 8, // decimals()
  "0x06fdde03": 2 + 8, // name()
  "0x18160ddd": 2 + 8, // totalSupply()
  "0x70a08231": 2 + 8 + 64, // balanceOf(address)
  "0x01ffc9a7": 2 + 8 + 64, // supportsInterface(bytes4)
};
/** Permit2 allowance(address owner, address token, address spender). */
export const PERMIT2_ALLOWANCE = "0x927da105";
const AGGREGATE3 = "0x82ad56cb";

/** True when `data` is one of the token reads above, within its size. */
export function isTokenRead(data: unknown): boolean {
  if (typeof data !== "string" || !/^0x[0-9a-fA-F]*$/.test(data) || data.length < 10) return false;
  const max = READ_SELECTORS[data.slice(0, 10).toLowerCase()];
  return max !== undefined && data.length <= max;
}

/**
 * Normalises a call object before it is checked and forwarded. The node reads `input` as well as `data`, so `input`
 * is folded into `data` (refused when the two disagree) and every check sees the bytes that will run; a call without
 * `gas` gets the relay cap. Mutates `tx`; running it twice is harmless.
 */
function shapeTx(tx: Record<string, unknown>, cap = GAS_CAP_HEX): string | null {
  // The node decodes field names case-insensitively ("TO" would override "to"), so only these exact names pass.
  for (const k of Object.keys(tx)) if (!CALL_KEYS.has(k)) return `Unsupported call field: ${k.slice(0, 32)}`;
  if (tx.input !== undefined) {
    if (tx.data !== undefined && tx.data !== tx.input) return "data and input disagree.";
    tx.data = tx.input;
    delete tx.input;
  }
  if (tx.data !== undefined && (typeof tx.data !== "string" || !/^0x[0-9a-fA-F]*$/.test(tx.data))) return "Call data must be hex.";
  if (tx.value !== undefined && !(typeof tx.value === "string" && /^0x0*$/.test(tx.value))) return "Calls with value are not relayed.";
  if (tx.gas === undefined) tx.gas = cap;
  return null;
}
export const MAX_BODY = 131_072;
export const BUDGET = { units: 2_000, windowSec: 600, siteUnits: 40_000 };

export const COST: Record<string, number> = {
  eth_getLogs: 10,
  eth_call: 2,
  eth_getTransactionReceipt: 1,
  eth_getTransactionByHash: 1,
  eth_blockNumber: 1,
  eth_getBalance: 1,
  eth_chainId: 1,
  eth_gasPrice: 1,
  eth_getBlockByNumber: 1,
  eth_getTransactionCount: 1,
  eth_maxPriorityFeePerGas: 1,
  eth_getCode: 1,
  eth_estimateGas: 3,
};

/** Call data limit in hex characters for reads of known contracts (a label write dry run is the largest). */
export const MAX_CALL_DATA = 4_000;
/** Multicall3 batches carry many small reads. */
export const MAX_MULTICALL_DATA = 2 + 8 + 128 + MAX_MULTICALL * 64 * 10;

/** Contracts the browser reads through the relay by address. eth_getCode and receipts are answered for any address. */
export function readTargets() {
  const list: string[] = [USDG.address, WETH, ETH_USD_FEED, MULTICALL3, PERMIT2];
  if (isAddress(BRAND.ca)) list.push(BRAND.ca);
  if (isAddress(CONTRACTS.labels)) list.push(CONTRACTS.labels);
  return new Set(list.map((a) => a.toLowerCase()));
}

/** Addresses a batch reads (eth_call targets and log filter addresses), lowercased. */
export function namedAddresses(body: Call | Call[]): string[] {
  const calls = Array.isArray(body) ? body : [body];
  const out = new Set<string>();
  for (const c of calls) {
    if (!c || !Array.isArray(c.params)) continue;
    const first = c.params[0] as { to?: unknown; address?: unknown } | undefined;
    if (!first || typeof first !== "object") continue;
    if ((c.method === "eth_call" || c.method === "eth_estimateGas") && typeof first.to === "string") out.add(first.to.toLowerCase());
    if (c.method === "eth_getLogs") {
      const a = first.address;
      for (const x of typeof a === "string" ? [a] : Array.isArray(a) ? a : []) if (typeof x === "string") out.add(x.toLowerCase());
    }
  }
  return [...out].filter((a) => /^0x[0-9a-f]{40}$/.test(a));
}

/** Number of inner calls in an aggregate3 call (0 when it does not decode). */
export function multicallSize(data: string): number {
  try {
    return (decodeFunctionData({ abi: MULTICALL3_ABI, data: data as `0x${string}` }).args[0] as readonly unknown[]).length;
  } catch {
    return 0;
  }
}

/** Checks a Multicall3 aggregate3 call: every inner call must be a token read (or a Permit2 / labels read). */
export function checkMulticall(data: string, labels: string = CONTRACTS.labels): string | null {
  if (data.slice(0, 10).toLowerCase() !== AGGREGATE3) return "Only Multicall3 aggregate3 is relayed.";
  if (data.length > MAX_MULTICALL_DATA) return "Multicall batch too large.";
  let calls: readonly { target: string; allowFailure: boolean; callData: string }[];
  try {
    calls = decodeFunctionData({ abi: MULTICALL3_ABI, data: data as `0x${string}` }).args[0] as never;
  } catch {
    return "Multicall data does not decode.";
  }
  if (calls.length === 0 || calls.length > MAX_MULTICALL) return `Between 1 and ${MAX_MULTICALL} calls per Multicall batch.`;
  const p2 = PERMIT2.toLowerCase();
  const lab = labels.toLowerCase();
  for (const c of calls) {
    const t = c.target.toLowerCase();
    if (t === p2 && c.callData.slice(0, 10).toLowerCase() === PERMIT2_ALLOWANCE && c.callData.length === 2 + 8 + 192) continue;
    if (/^0x[0-9a-f]{40}$/.test(lab) && t === lab && c.callData.length <= MAX_CALL_DATA) continue;
    if (t === MULTICALL3.toLowerCase()) return "Nested Multicall is not relayed.";
    if (!isTokenRead(c.callData)) return "Multicall carries a call that is not a token read.";
  }
  return null;
}

const TOPIC = /^0x[0-9a-f]{64}$/;
const PADDED = /^0x0{24}[0-9a-f]{40}$/;
const LABEL_TOPICS = [
  "Labeled(address,address,string,uint8,string,bytes32,bool,uint64)",
  "LabelRemoved(address,address,uint64)",
  "Flagged(address,address,uint8,uint64)",
  "Unflagged(address,address,uint64)",
].map((s) => toEventSelector(s));

const asList = (v: unknown): unknown[] | null => (typeof v === "string" ? [v] : Array.isArray(v) ? v : null);

export type LogShape = "owner" | "permit2" | "labels";

/** Classifies a log filter as one the site itself issues; returns its shape, or the reason it is refused. */
export function logShape(address: unknown, topics: unknown, labelsAddress: string = CONTRACTS.labels): { shape: LogShape } | { error: string } {
  if (!Array.isArray(topics) || topics.length < 1) return { error: "eth_getLogs needs topics." };
  const first = asList(topics[0]);
  const lower = (x: unknown) => (typeof x === "string" ? x.toLowerCase() : "");
  // Owner shapes: exactly [events, one padded owner].
  const ownerTopic = () => {
    if (topics.length !== 2) return false;
    const o = asList(topics[1]);
    return Boolean(o && o.length === 1 && typeof o[0] === "string" && TOPIC.test(o[0].toLowerCase()) && PADDED.test(o[0].toLowerCase()));
  };
  if (address === undefined || address === null) {
    // Token approvals and Permit2's own events in one query: Permit2 events are recognised by their emitter later.
    const allowed = [...TOKEN_TOPICS, ...PERMIT2_TOPICS] as readonly string[];
    if (!first || first.length < 1 || first.length > allowed.length || !first.every((t) => allowed.includes(lower(t)))) return { error: "Approval queries must name the approval events." };
    if (!ownerTopic()) return { error: "Approval queries need exactly one owner in topic 1." };
    return { shape: "owner" };
  }
  const addrs = asList(address);
  if (!addrs || addrs.length !== 1 || typeof addrs[0] !== "string") return { error: "eth_getLogs takes one address." };
  const a = addrs[0].toLowerCase();
  if (a === PERMIT2.toLowerCase()) {
    if (!first || first.length < 1 || first.length > 3 || !first.every((t) => (PERMIT2_TOPICS as readonly string[]).includes(lower(t)))) return { error: "Permit2 queries must name Permit2 approval events." };
    if (!ownerTopic()) return { error: "Permit2 queries need exactly one owner in topic 1." };
    return { shape: "permit2" };
  }
  const lab = labelsAddress.toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(lab) && a === lab) {
    if (topics.length > 2) return { error: "Label queries take topics [event] or [event, spender]." };
    if (!first || first.length < 1 || first.length > 4 || !first.every((t) => (LABEL_TOPICS as string[]).includes(lower(t)))) return { error: "Label queries must name label events." };
    if (topics.length === 2) {
      const s = asList(topics[1]);
      if (!s || s.length < 1 || s.length > 20 || !s.every((t) => typeof t === "string" && PADDED.test(t.toLowerCase()))) return { error: "Label queries take padded spender addresses in topic 1." };
    }
    return { shape: "labels" };
  }
  return { error: "eth_getLogs address not served by this relay." };
}

export type Call = { jsonrpc?: string; id?: unknown; method: string; params?: unknown[] };

const hexBlock = (v: unknown) => (typeof v === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(v) ? Number(BigInt(v)) : null);
const gasOf = (g: unknown) => (typeof g === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(g) ? Number(BigInt(g)) : Infinity);

/** Checks a batch and returns its cost in units, or the reason it is refused. */
export function checkBatch(calls: Call[], targets = readTargets(), labelsAddress: string = CONTRACTS.labels): { units: number } | { error: string } {
  if (calls.length === 0 || calls.length > MAX_CALLS) return { error: `Between 1 and ${MAX_CALLS} calls per request.` };
  let units = 0;
  let logs = 0;
  let span = 0;
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    if (!c || typeof c.method !== "string" || !Object.hasOwn(COST, c.method)) return { error: `Method not allowed: ${String(c?.method)}` };
    if (c.params !== undefined && !Array.isArray(c.params)) return { error: "params must be an array." };
    const params = c.params ?? [];
    units += COST[c.method];
    if (c.method === "eth_getLogs") {
      logs += 1;
      if (logs > MAX_LOGS_PER_BATCH) return { error: `At most ${MAX_LOGS_PER_BATCH} log queries per request.` };
      const filter = (params[0] ?? {}) as { address?: unknown; fromBlock?: unknown; toBlock?: unknown; blockHash?: unknown; topics?: unknown };
      if (typeof filter !== "object" || filter === null || Array.isArray(filter)) return { error: "eth_getLogs needs a filter object." };
      const oddKey = Object.keys(filter).find((k) => !LOG_KEYS.has(k));
      if (oddKey) return { error: `Unsupported filter field: ${oddKey.slice(0, 32)}` };
      if (filter.blockHash !== undefined) return { error: "blockHash filters are not relayed." };
      const shaped = logShape(filter.address, filter.topics, labelsAddress);
      if ("error" in shaped) return { error: shaped.error };
      if (shaped.shape === "labels") {
        const a = (asList(filter.address)?.[0] as string).toLowerCase();
        if (!targets.has(a)) return { error: "eth_getLogs address not served by this relay." };
      }
      // Both ends must be hex numbers: "latest" or a missing bound would let one request scan the whole chain.
      const from = hexBlock(filter.fromBlock);
      const to = hexBlock(filter.toBlock);
      if (from === null || to === null) return { error: "eth_getLogs needs numeric fromBlock and toBlock." };
      if (to < from) return { error: "toBlock is before fromBlock." };
      const width = to - from + 1;
      if (width > (shaped.shape === "labels" ? MAX_LABEL_LOG_SPAN : MAX_OWNER_LOG_SPAN)) return { error: "Log range too wide." };
      span += width;
      if (span > MAX_BATCH_SPAN) return { error: "Log range too wide." };
      // Priced by the blocks it covers. Owner-filtered queries (owner topic, with or without Permit2 as address) are
      // index lookups, so they step by OWNER_LOG_STEP; label queries scan one contract's events by 1,000 blocks.
      units += shaped.shape === "labels" ? Math.ceil(width / 1_000) : Math.ceil(width / OWNER_LOG_STEP);
    }
    if (c.method === "eth_call" || c.method === "eth_estimateGas") {
      if (params.length > 2) return { error: "State overrides are not relayed." };
      const tx = params[0] as { to?: unknown; gas?: unknown; data?: unknown } | undefined;
      if (!tx || typeof tx !== "object" || typeof tx.to !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(tx.to)) return { error: `${c.method} needs a target address.` };
      const to = tx.to.toLowerCase();
      const known = targets.has(to);
      const data = (tx as { data?: unknown; input?: unknown }).data ?? (tx as { input?: unknown }).input;
      const foreign = !known && c.method === "eth_call" && isTokenRead(data);
      if (!known && !foreign) return { error: `${c.method} target not served by this relay.` };
      if (c.method === "eth_estimateGas" && !(isAddress(labelsAddress) && to === labelsAddress.toLowerCase())) return { error: "eth_estimateGas is relayed only for the labels contract." };
      const shaped = shapeTx(tx as Record<string, unknown>, foreign ? FOREIGN_GAS_HEX : GAS_CAP_HEX);
      if (shaped) return { error: shaped };
      if (params[1] !== undefined && !(typeof params[1] === "string" && BLOCK_TAG.test(params[1]))) return { error: "Unsupported block tag." };
      if (gasOf(tx.gas) > (foreign ? MAX_FOREIGN_GAS : MAX_GAS)) return { error: "Gas above the relay cap." };
      const d = typeof tx.data === "string" ? tx.data : "0x";
      if (to === MULTICALL3.toLowerCase()) {
        const m = checkMulticall(d, labelsAddress);
        if (m) return { error: m };
        // A multicall is one upstream call: priced by its number of inner reads.
        units += Math.ceil(multicallSize(d) / MULTICALL_CALLS_PER_UNIT);
      } else if (to === PERMIT2.toLowerCase()) {
        if (d.slice(0, 10).toLowerCase() !== PERMIT2_ALLOWANCE) return { error: "Only Permit2 allowance reads are relayed." };
      } else if (d.length > MAX_CALL_DATA) return { error: "Call data too large." };
    }
    if (c.method === "eth_getBlockByNumber" && params[1] !== false) return { error: "eth_getBlockByNumber is relayed only with full transactions off (false)." };
  }
  return { units };
}

export type RpcAnswer = { result: unknown } | { error: { code: number; message: string; data?: string } } | { down: true };

export type RelayDeps = {
  /** Charges the caller's budgets; returns the refusal message, or null when allowed. */
  charge: (units: number) => Promise<string | null>;
  one: (method: string, params: unknown[]) => Promise<RpcAnswer>;
  many: (calls: { method: string; params: unknown[] }[]) => Promise<(unknown | null)[]>;
};

/**
 * The relay's whole decision, without I/O of its own: shape and price first, then the budget, then
 * the target allowlist, and only then the upstream RPC. A refused request never reaches the RPC.
 */
export async function runRelay(body: Call | Call[], deps: RelayDeps): Promise<{ status: number; body: unknown }> {
  const calls = Array.isArray(body) ? body : [body];
  const targets = readTargets();
  // Priced with every named address allowed first, so a refused target still costs budget.
  const priced = checkBatch(calls, new Set([...targets, ...namedAddresses(body)]));
  if ("error" in priced) return { status: 400, body: { error: priced.error } };
  const refused = await deps.charge(priced.units);
  if (refused) return { status: 429, body: { error: refused } };
  const checked = checkBatch(calls, targets);
  if ("error" in checked) return { status: 400, body: { error: checked.error } };
  if (calls.length === 1 && !Array.isArray(body)) {
    const c = calls[0];
    const a = await deps.one(c.method, c.params ?? []);
    if ("down" in a) return { status: 502, body: { error: "The chain could not be reached." } };
    return { status: 200, body: { jsonrpc: "2.0", id: c.id ?? null, ...a } };
  }
  try {
    const results = await deps.many(calls.map((c) => ({ method: c.method, params: c.params ?? [] })));
    const out = calls.map((c, i) =>
      results[i] === null ? { jsonrpc: "2.0", id: c.id ?? null, error: { code: -32000, message: "read failed" } } : { jsonrpc: "2.0", id: c.id ?? null, result: results[i] },
    );
    return { status: 200, body: Array.isArray(body) ? out : out[0] };
  } catch {
    return { status: 502, body: { error: "The chain could not be reached." } };
  }
}
