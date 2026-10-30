import "server-only";
import { BRAND, USDG, WETH, isAddress } from "@/config/brand";
import { readCappedResponse } from "@/lib/server/capped";
import { ponsCurves } from "@/lib/server/chainread";

/*
 * Token list for the quick check: the tokens of the most active pools on Robinhood Chain according to GeckoTerminal's
 * public API (no key, five pages of pools), plus USDG, WETH and $NULLO once launched. Each token's Pons V2 curve is
 * resolved on chain (src/lib/server/chainread.ts), so the quick check also reads the allowance to that curve.
 * Cached for 30 minutes; a failed refresh keeps the last good list, and with no list at all the fixed tokens still
 * work. Only addresses and symbols come from GeckoTerminal: every allowance is read from the chain.
 */

export type ListedToken = { address: string; symbol: string; curve?: string | null };

const TTL = 30 * 60_000;
/** A list that holds only the fixed tokens (GeckoTerminal did not answer) is retried after a minute. */
const RETRY = 60_000;
export const MAX_TOKENS = 100;
const PAGES = [1, 2, 3, 4, 5];
let cache: { at: number; list: ListedToken[] } | null = null;
let inflight: Promise<void> | null = null;

const fixed = (): ListedToken[] => {
  const out = [
    { address: USDG.address, symbol: USDG.symbol },
    { address: WETH, symbol: "WETH" },
  ];
  if (isAddress(BRAND.ca)) out.push({ address: BRAND.ca, symbol: BRAND.ticker });
  return out;
};

type Included = { id: string; type: string; attributes?: { address?: string; symbol?: string } };

async function fetchPage(page: number): Promise<ListedToken[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/robinhood/pools?page=${page}&include=base_token,quote_token`, { headers: { accept: "application/json" }, cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return [];
    const text = await readCappedResponse(res, 1_500_000);
    if (!text) return [];
    const body = JSON.parse(text) as { included?: Included[] };
    return (body.included ?? [])
      .filter((x) => x.type === "token" && typeof x.attributes?.address === "string" && isAddress(x.attributes.address) && !/^0x0{40}$/i.test(x.attributes.address))
      .map((x) => ({ address: x.attributes!.address!, symbol: String(x.attributes!.symbol ?? "?").slice(0, 16) }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export async function tokenList(): Promise<{ list: ListedToken[]; at: number | null; source: string }> {
  const full = Boolean(cache && cache.list.length > fixed().length);
  if ((!cache || Date.now() - cache.at > (full ? TTL : RETRY)) && !inflight) {
    inflight = Promise.all(PAGES.map(fetchPage))
      .then(async (pages) => {
        const seen = new Set<string>();
        const list: ListedToken[] = [];
        for (const t of [...fixed(), ...pages.flat()]) {
          const k = t.address.toLowerCase();
          if (seen.has(k) || list.length >= MAX_TOKENS) continue;
          seen.add(k);
          list.push(t);
        }
        const curves = await ponsCurves(list.map((t) => t.address)).catch(() => new Map<string, string | null>());
        for (const t of list) if (curves.has(t.address.toLowerCase())) t.curve = curves.get(t.address.toLowerCase()) ?? null;
        // A failed refresh keeps the last full list; with none, the fixed list is kept and retried soon.
        if (list.length > fixed().length || !cache || cache.list.length <= fixed().length) cache = { at: Date.now(), list };
      })
      .finally(() => {
        inflight = null;
      });
  }
  if (!cache && inflight) await inflight;
  return cache && cache.list.length > fixed().length
    ? { list: cache.list, at: cache.at, source: "GeckoTerminal (top pools on Robinhood Chain) + fixed tokens, Pons curves read on chain" }
    : { list: cache?.list ?? fixed(), at: cache?.at ?? null, source: "fixed tokens only (GeckoTerminal did not answer; retried within a minute)" };
}
