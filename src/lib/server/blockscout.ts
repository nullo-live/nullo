import "server-only";
import { CHAIN, PERMIT2 } from "@/config/brand";
import { APPROVAL_FOR_ALL_TOPIC, APPROVAL_TOPIC, P2_APPROVAL_TOPIC, P2_LOCKDOWN_TOPIC, P2_PERMIT_TOPIC, padTopic, type RawLog } from "@/lib/approvals";
import { readCappedResponse } from "@/lib/server/capped";

/*
 * Second source: Blockscout's PRO API (api.blockscout.com) with the optional BLOCKSCOUT_API_KEY. It answers log
 * queries over the whole chain history, which public RPC endpoints refuse, and tells whether a contract's source is
 * published. Without the key every function here returns { configured: false } and the site uses chain reads only.
 * The key stays on the server; answers are cached briefly and only shapes the site needs are requested.
 */

const API = "https://api.blockscout.com/v2/api";
export const blockscoutConfigured = () => Boolean(process.env.BLOCKSCOUT_API_KEY);

async function get(params: Record<string, string>): Promise<unknown> {
  const key = process.env.BLOCKSCOUT_API_KEY ?? "";
  const qs = new URLSearchParams({ chain_id: String(CHAIN.id), ...params, apikey: key });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(`${API}?${qs}`, { headers: { accept: "application/json" }, cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`Blockscout ${res.status}`);
    const text = await readCappedResponse(res, 4_000_000);
    if (text === null) throw new Error("Blockscout answer too large");
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

type BsLog = { address: string; topics: (string | null)[]; data: string; blockNumber: string; transactionHash: string; logIndex: string };

const hexish = (v: string) => (/^0x/.test(v) ? v : `0x${BigInt(v || "0").toString(16)}`);

/** Logs for one topic0 + owner topic1 across the whole chain (paged, at most `pages` x 1,000). */
async function logs(topic0: string, owner: string, address: string | null, pages = 3): Promise<RawLog[]> {
  const out: RawLog[] = [];
  for (let page = 1; page <= pages; page++) {
    const params: Record<string, string> = { module: "logs", action: "getLogs", fromBlock: "0", toBlock: "latest", topic0, topic1: padTopic(owner), topic0_1_opr: "and", page: String(page), offset: "1000" };
    if (address) params.address = address;
    const body = (await get(params)) as { status?: string; result?: BsLog[] | string };
    if (!Array.isArray(body.result)) break;
    for (const l of body.result)
      out.push({ address: l.address, topics: l.topics.filter((x): x is string => typeof x === "string"), data: l.data || "0x", blockNumber: hexish(l.blockNumber), transactionHash: l.transactionHash, logIndex: hexish(l.logIndex || "0") });
    if (body.result.length < 1000) break;
  }
  return out;
}

const historyCache = new Map<string, { at: number; value: RawLog[] }>();

/** Every approval-type log of `owner` (token approvals, operator approvals, Permit2) from Blockscout. */
export async function ownerHistory(owner: string): Promise<{ configured: boolean; logs: RawLog[]; capped: boolean }> {
  if (!blockscoutConfigured()) return { configured: false, logs: [], capped: false };
  const k = owner.toLowerCase();
  const hit = historyCache.get(k);
  if (hit && Date.now() - hit.at < 60_000) return { configured: true, logs: hit.value, capped: hit.value.length >= 3000 };
  const parts = await Promise.all([
    logs(APPROVAL_TOPIC, owner, null),
    logs(APPROVAL_FOR_ALL_TOPIC, owner, null),
    logs(P2_APPROVAL_TOPIC, owner, PERMIT2, 1),
    logs(P2_PERMIT_TOPIC, owner, PERMIT2, 1),
    logs(P2_LOCKDOWN_TOPIC, owner, PERMIT2, 1),
  ]);
  const all = parts.flat();
  if (historyCache.size > 500) historyCache.clear();
  historyCache.set(k, { at: Date.now(), value: all });
  return { configured: true, logs: all, capped: parts.some((p) => p.length >= 3000) };
}

const sourceCache = new Map<string, { at: number; value: { verified: boolean; name: string | null } }>();

/** Whether the explorer has published source for `address`, and the contract name it lists. */
export async function sourceInfo(address: string): Promise<{ configured: boolean; verified: boolean | null; name: string | null }> {
  if (!blockscoutConfigured()) return { configured: false, verified: null, name: null };
  const k = address.toLowerCase();
  const hit = sourceCache.get(k);
  if (hit && Date.now() - hit.at < 3_600_000) return { configured: true, ...hit.value };
  const body = (await get({ module: "contract", action: "getsourcecode", address })) as { result?: { SourceCode?: string; ContractName?: string }[] };
  const r = Array.isArray(body.result) ? body.result[0] : undefined;
  const value = { verified: Boolean(r?.SourceCode), name: r?.ContractName ? String(r.ContractName).slice(0, 64) : null };
  if (sourceCache.size > 2000) sourceCache.clear();
  sourceCache.set(k, { at: Date.now(), value });
  return { configured: true, ...value };
}
