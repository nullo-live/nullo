import "server-only";
import { BRAND, USDG, WETH, isAddress } from "@/config/brand";
import { readCappedResponse } from "@/lib/server/capped";

/*
 * Token list for the quick check: the tokens of the most active pools on Robinhood Chain according to GeckoTerminal's
 * public API (no key), plus USDG, WETH and $NULLO once launched. Cached for 30 minutes; a failed refresh keeps the last
 * good list, and with no list at all the three fixed tokens still work. Only addresses and symbols come from here:
 * every allowance is read from the chain.
 */

export type ListedToken = { address: string; symbol: string };

const TTL = 30 * 60_000;
const MAX = 60;
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
  if ((!cache || Date.now() - cache.at > TTL) && !inflight) {
    inflight = Promise.all([1, 2, 3].map(fetchPage))
      .then((pages) => {
        const seen = new Set<string>();
        const list: ListedToken[] = [];
        for (const t of [...fixed(), ...pages.flat()]) {
          const k = t.address.toLowerCase();
          if (seen.has(k) || list.length >= MAX) continue;
          seen.add(k);
          list.push(t);
        }
        if (list.length > fixed().length || !cache) cache = { at: Date.now(), list };
      })
      .finally(() => {
        inflight = null;
      });
  }
  if (!cache && inflight) await inflight;
  return cache ? { list: cache.list, at: cache.at, source: "GeckoTerminal (top pools on Robinhood Chain) + fixed tokens" } : { list: fixed(), at: null, source: "fixed tokens only" };
}
