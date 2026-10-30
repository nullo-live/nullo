import { getAddress } from "viem";
import { isOpen, isUnlimited, type Current, type Kind, type Pair } from "@/lib/approvals";
import type { Range } from "@/lib/coverage";

/*
 * Shape of GET /api/approvals?owner=0x…, free of I/O so it can be tested. This is the integration point for other
 * sites (FLIQO's wallet page first): one owner in, the permissions that are open right now out, with what was read
 * to find them. Amounts are decimal strings (they do not fit a JSON number).
 */

export type ApiApproval = {
  token: string;
  tokenSymbol: string | null;
  spender: string;
  /** Name from the site's confirmed spender list (or "Pons bonding curve (SYMBOL)"); null when not listed. */
  spenderLabel: string | null;
  kind: Kind;
  /** erc20 / permit2: allowance in the token's smallest unit. NFT kinds: null (see tokenId / kind). */
  amount: string | null;
  unlimited: boolean;
  /** nft-one only. */
  tokenId: string | null;
  /** permit2 only: unix seconds; 0 = no expiry set. */
  expiration: number | null;
  /** Which reads found the pair: "logs" (chain events), "explorer" (Blockscout history), "quick" (known spenders). */
  foundBy: string[];
};

export type ApiCoverage = {
  /** Lowest block of the event range that reaches toBlock without a hole (null when no event range was read). */
  fromBlock: number | null;
  toBlock: number;
  /** "blockscout" = whole history from the explorer; "rpc" = owner-filtered log windows only; "quick" = no events. */
  source: "blockscout" | "rpc" | "quick";
  /** Every event range read so far for this owner (merged, inclusive). */
  ranges: Range[];
  /** Blocks of [1, toBlock] not covered by any event read. */
  missingBlocks: number;
  quickCheck: { tokens: number; pairs: number };
  /** Short facts about what could not be read. */
  notes: string[];
};

export type ApiAnswer = {
  owner: string;
  approvals: ApiApproval[];
  counts: { open: number; unlimited: number };
  coverage: ApiCoverage;
  generatedAt: number;
  cached: boolean;
};

const ALLOWED_PARAMS = new Set(["owner"]);

/** Strict query check: exactly one `owner`, 0x + 40 hex, nothing else. Returns the checksummed owner. */
export function parseApprovalsQuery(search: URLSearchParams): { owner: string } | { error: string } {
  for (const k of search.keys()) if (!ALLOWED_PARAMS.has(k)) return { error: `Unknown parameter: ${k.slice(0, 32)}` };
  const all = search.getAll("owner");
  if (all.length !== 1) return { error: "Give exactly one owner: /api/approvals?owner=0x…" };
  const owner = all[0];
  if (!/^0x[0-9a-fA-F]{40}$/.test(owner)) return { error: "owner must be 0x followed by 40 hex characters." };
  if (/^0x0{40}$/i.test(owner)) return { error: "owner cannot be the zero address." };
  return { owner: getAddress(owner) };
}

/** Builds the answer from the pairs found and their fresh state. Only pairs open right now are listed. */
export function buildAnswer(input: {
  owner: string;
  pairs: Pair[];
  current: Map<string, Current>;
  symbols: Map<string, string | null>;
  label: (spender: string) => string | null;
  coverage: ApiCoverage;
  nowSec: number;
}): Omit<ApiAnswer, "cached"> {
  const approvals: ApiApproval[] = [];
  for (const p of input.pairs) {
    const c = input.current.get(p.key);
    if (!c || !isOpen(p, c, input.nowSec)) continue;
    const token = p.token.toLowerCase();
    const money = p.kind === "erc20" || p.kind === "permit2";
    approvals.push({
      token: getAddress(p.token),
      tokenSymbol: input.symbols.get(token) ?? null,
      spender: getAddress(p.kind === "nft-one" && c.approvedNow ? c.approvedNow : p.spender),
      spenderLabel: input.label(p.kind === "nft-one" && c.approvedNow ? c.approvedNow : p.spender),
      kind: p.kind,
      amount: money && c.amount !== null ? c.amount.toString() : null,
      unlimited: money ? isUnlimited(p.kind, c.amount) : p.kind === "nft-all",
      tokenId: p.kind === "nft-one" && p.tokenId !== null ? p.tokenId.toString() : null,
      expiration: p.kind === "permit2" ? (c.expiration ?? null) : null,
      foundBy: [...p.source].sort(),
    });
  }
  // Unlimited first, then by token and spender, so the order is stable between calls.
  approvals.sort((a, b) => Number(b.unlimited) - Number(a.unlimited) || a.token.localeCompare(b.token) || a.spender.localeCompare(b.spender) || a.kind.localeCompare(b.kind));
  return {
    owner: getAddress(input.owner),
    approvals,
    counts: { open: approvals.length, unlimited: approvals.filter((a) => a.unlimited).length },
    coverage: input.coverage,
    generatedAt: input.nowSec,
  };
}

/** The contiguous covered range that ends at `head` (newest blocks read without a hole), or null. */
export function contiguousFrom(ranges: Range[], head: number): number | null {
  const top = [...ranges].sort((a, b) => b[1] - a[1]).find(([a, b]) => a <= head && b >= head);
  return top ? top[0] : null;
}
