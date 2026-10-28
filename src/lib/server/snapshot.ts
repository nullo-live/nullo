import "server-only";
import { decodeFunctionResult, encodeFunctionData, type Abi } from "viem";
import { BRAND, ETH_USD_FEED, isAddress } from "@/config/brand";
import { CONTRACTS, labelsLive } from "@/config/contracts";
import { ERC20_ABI, FEED_ABI, LABELS_ABI } from "@/lib/abi";
import { rpcBatch } from "@/lib/feeds/rpc";

/*
 * Live facts for the whole site, all read from Robinhood Chain: the latest block and gas, the block pace,
 * ETH / USD from Chainlink, the token once its address is published and the NulloSpenderLabels totals once deployed.
 */

export type ChainSnapshot = {
  at: number;
  block: number | null;
  blockTime: number | null;
  blockPace: number | null;
  gasGwei: number | null;
  ethUsd: number | null;
  ethUsdAt: number | null;
  token: { name: string | null; symbol: string | null; supply: string | null; decimals: number | null } | null;
  labels: { labels: number | null; flags: number | null; spenders: number | null } | null;
  /** Public market data for the token once it trades (GeckoTerminal, network "robinhood"); null before. */
  market: { priceUsd: number | null; fdvUsd: number | null; volume24hUsd: number | null; liquidityUsd: number | null } | null;
};

const num = (v: unknown) => {
  const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Keyless GeckoTerminal read for the token; any failure is simply "no market data". */
async function readMarket(ca: string): Promise<ChainSnapshot["market"]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/${ca.toLowerCase()}`, { headers: { accept: "application/json" }, cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { attributes?: Record<string, unknown> } };
    const a = body.data?.attributes;
    if (!a) return null;
    return { priceUsd: num(a.price_usd), fdvUsd: num(a.fdv_usd), volume24hUsd: num((a.volume_usd as { h24?: unknown } | undefined)?.h24), liquidityUsd: num(a.total_reserve_in_usd) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type Read = { to: string; abi: Abi; fn: string };
const call = (r: Read) => ({ method: "eth_call", params: [{ to: r.to, data: encodeFunctionData({ abi: r.abi, functionName: r.fn, args: [] } as never) }, "latest"] });
function decode<T>(r: Read, raw: unknown): T | null {
  if (typeof raw !== "string" || raw.length < 4) return null;
  try {
    return decodeFunctionResult({ abi: r.abi, functionName: r.fn, data: raw as `0x${string}` } as never) as T;
  } catch {
    return null;
  }
}

export async function readSnapshot(): Promise<ChainSnapshot> {
  const ca = isAddress(BRAND.ca) ? BRAND.ca : null;
  const reads: Read[] = [{ to: ETH_USD_FEED, abi: FEED_ABI as Abi, fn: "latestRoundData" }];
  if (ca) for (const fn of ["name", "symbol", "totalSupply", "decimals"]) reads.push({ to: ca, abi: ERC20_ABI as Abi, fn });
  if (labelsLive()) for (const fn of ["totalLabels", "totalFlags", "spenderCount"]) reads.push({ to: CONTRACTS.labels, abi: LABELS_ABI as Abi, fn });
  const head = [
    { method: "eth_getBlockByNumber", params: ["latest", false] },
    { method: "eth_gasPrice", params: [] },
  ];
  const [h, results, market] = await Promise.all([rpcBatch<unknown>(head).catch(() => [null, null]), rpcBatch<unknown>(reads.map(call)).catch(() => reads.map(() => null)), ca ? readMarket(ca) : Promise.resolve(null)]);
  const block = h[0] && typeof h[0] === "object" ? (h[0] as { number: string; timestamp: string }) : null;
  const gas = typeof h[1] === "string" ? h[1] : null;
  let pace: number | null = null;
  if (block) {
    const back = await rpcBatch<{ timestamp: string }>([{ method: "eth_getBlockByNumber", params: [`0x${(BigInt(block.number) - 3000n).toString(16)}`, false] }]).catch(() => [null]);
    if (back[0]) pace = (Number(BigInt(block.timestamp)) - Number(BigInt(back[0].timestamp))) / 3000;
  }
  let i = 0;
  const feed = decode<readonly [bigint, bigint, bigint, bigint, bigint]>(reads[i], results[i]);
  i++;
  let token: ChainSnapshot["token"] = null;
  if (ca) {
    const v = reads.slice(i, i + 4).map((r, k) => decode<string | bigint | number>(r, results[i + k]));
    i += 4;
    token = {
      name: typeof v[0] === "string" ? v[0] : null,
      symbol: typeof v[1] === "string" ? v[1] : null,
      supply: typeof v[2] === "bigint" ? v[2].toString() : null,
      decimals: v[3] === null ? null : Number(v[3]),
    };
  }
  let labels: ChainSnapshot["labels"] = null;
  if (labelsLive()) {
    const [n, p, f] = [0, 1, 2].map((k) => decode<bigint>(reads[i + k], results[i + k]));
    labels = { labels: n === null ? null : Number(n), flags: p === null ? null : Number(p), spenders: f === null ? null : Number(f) };
  }
  return {
    at: Date.now(),
    block: block ? Number(BigInt(block.number)) : null,
    blockTime: block ? Number(BigInt(block.timestamp)) : null,
    blockPace: pace,
    gasGwei: gas ? Number(BigInt(gas)) / 1e9 : null,
    ethUsd: feed && feed[1] > 0n ? Number(feed[1]) / 1e8 : null,
    ethUsdAt: feed ? Number(feed[3]) : null,
    token,
    labels,
    market,
  };
}
