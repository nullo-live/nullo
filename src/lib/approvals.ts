import { decodeAbiParameters, encodeFunctionData, getAddress, toEventSelector } from "viem";
import { ERC20_ABI, NFT_ABI, PERMIT2_ABI } from "@/lib/abi";

/*
 * Permission model, free of I/O so every rule can be tested. A permission is one (kind, token, spender[, tokenId])
 * pair a wallet granted. Events tell us where to look; the current state always comes from a fresh read of the token
 * (allowance / isApprovedForAll / getApproved) or Permit2. An event alone never decides that a permission is open.
 */

/** ERC-20 Approval and ERC-721 Approval share this selector (ERC-721 has the token id as a third indexed topic). */
export const APPROVAL_TOPIC = toEventSelector("Approval(address,address,uint256)");
/** ERC-721 and ERC-1155 operator approvals. */
export const APPROVAL_FOR_ALL_TOPIC = toEventSelector("ApprovalForAll(address,address,bool)");
/** Permit2's own allowance events (emitted by the Permit2 contract, token in topic 2, spender in topic 3). */
export const P2_APPROVAL_TOPIC = toEventSelector("Approval(address,address,address,uint160,uint48)");
export const P2_PERMIT_TOPIC = toEventSelector("Permit(address,address,address,uint160,uint48,uint48)");
export const P2_LOCKDOWN_TOPIC = toEventSelector("Lockdown(address,address,address)");

export const TOKEN_TOPICS = [APPROVAL_TOPIC, APPROVAL_FOR_ALL_TOPIC] as const;
export const PERMIT2_TOPICS = [P2_APPROVAL_TOPIC, P2_PERMIT_TOPIC, P2_LOCKDOWN_TOPIC] as const;

export type Kind = "erc20" | "nft-all" | "nft-one" | "permit2";

export const KIND_WORDS: Record<Kind, string> = {
  erc20: "Token allowance",
  "nft-all": "Collection operator",
  "nft-one": "Single NFT",
  permit2: "Permit2 allowance",
};

export type RawLog = { address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string; logIndex: string };

/** One approval event, decoded. `amount` is set for erc20/permit2, `approved` for nft-all, `tokenId` for nft-one. */
export type ApprovalEvent = {
  kind: Kind;
  token: string;
  spender: string;
  amount: bigint | null;
  approved: boolean | null;
  tokenId: bigint | null;
  expiration: number | null;
  block: number;
  tx: string;
  logIndex: number;
  /** Permit2 Lockdown: every allowance for this pair was set to zero. */
  lockdown?: boolean;
};

const ZERO = "0x0000000000000000000000000000000000000000";
const addrFromTopic = (t: string) => getAddress(`0x${t.slice(26)}`);
const num = (hex: string) => Number(BigInt(hex));

/** 32-byte topic for an address filter (lower case). */
export function padTopic(address: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("not an address");
  return `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
}

/** Decodes one log from the token filter or the Permit2 filter; returns null for anything else. */
export function decodeLog(log: RawLog, permit2: string): ApprovalEvent | null {
  const t = log.topics.map((x) => x.toLowerCase());
  const base = { block: num(log.blockNumber), tx: log.transactionHash, logIndex: num(log.logIndex) };
  try {
    if (log.address.toLowerCase() === permit2.toLowerCase()) {
      if (t[0] === P2_APPROVAL_TOPIC || t[0] === P2_PERMIT_TOPIC) {
        if (t.length !== 4) return null;
        const types = t[0] === P2_APPROVAL_TOPIC ? [{ type: "uint160" }, { type: "uint48" }] : [{ type: "uint160" }, { type: "uint48" }, { type: "uint48" }];
        const v = decodeAbiParameters(types, log.data as `0x${string}`);
        return { kind: "permit2", token: addrFromTopic(t[2]), spender: addrFromTopic(t[3]), amount: v[0] as bigint, approved: null, tokenId: null, expiration: Number(v[1]), ...base };
      }
      if (t[0] === P2_LOCKDOWN_TOPIC && t.length === 2) {
        const [token, spender] = decodeAbiParameters([{ type: "address" }, { type: "address" }], log.data as `0x${string}`);
        return { kind: "permit2", token: getAddress(token), spender: getAddress(spender), amount: 0n, approved: null, tokenId: null, expiration: 0, lockdown: true, ...base };
      }
      return null;
    }
    if (t[0] === APPROVAL_TOPIC) {
      if (t.length === 3) {
        const [amount] = decodeAbiParameters([{ type: "uint256" }], log.data as `0x${string}`);
        return { kind: "erc20", token: getAddress(log.address), spender: addrFromTopic(t[2]), amount, approved: null, tokenId: null, expiration: null, ...base };
      }
      if (t.length === 4) return { kind: "nft-one", token: getAddress(log.address), spender: addrFromTopic(t[2]), amount: null, approved: null, tokenId: BigInt(t[3]), expiration: null, ...base };
      return null;
    }
    if (t[0] === APPROVAL_FOR_ALL_TOPIC && t.length === 3) {
      const [approved] = decodeAbiParameters([{ type: "bool" }], log.data as `0x${string}`);
      return { kind: "nft-all", token: getAddress(log.address), spender: addrFromTopic(t[2]), amount: null, approved, tokenId: null, expiration: null, ...base };
    }
  } catch {
    return null;
  }
  return null;
}

/** Stable key of a permission pair. Single-NFT approvals are keyed by token id, not by spender. */
export function pairKey(p: { kind: Kind; token: string; spender: string; tokenId?: bigint | null }): string {
  const tail = p.kind === "nft-one" ? `#${(p.tokenId ?? 0n).toString()}` : p.spender.toLowerCase();
  return `${p.kind}:${p.token.toLowerCase()}:${tail}`;
}

export type Pair = { key: string; kind: Kind; token: string; spender: string; tokenId: bigint | null; last: ApprovalEvent | null; events: number; source: Set<string> };

/** Groups events into pairs, newest event last-wins (by block, then log index). Zero-spender NFT approvals are clears. */
export function pairsFrom(events: ApprovalEvent[], source = "logs"): Map<string, Pair> {
  const out = new Map<string, Pair>();
  const sorted = [...events].sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);
  for (const e of sorted) {
    const key = pairKey(e);
    const prev = out.get(key);
    if (prev) {
      prev.last = e;
      prev.spender = e.kind === "nft-one" ? e.spender : prev.spender;
      prev.events += 1;
    } else out.set(key, { key, kind: e.kind, token: e.token, spender: e.spender, tokenId: e.tokenId, last: e, events: 1, source: new Set([source]) });
  }
  return out;
}

/** Merges pair maps from several sources (logs, Blockscout, quick check, manual), keeping the newest event. */
export function mergePairs(...maps: Map<string, Pair>[]): Map<string, Pair> {
  const out = new Map<string, Pair>();
  for (const m of maps)
    for (const [k, p] of m) {
      const prev = out.get(k);
      if (!prev) {
        out.set(k, { ...p, source: new Set(p.source) });
        continue;
      }
      for (const s of p.source) prev.source.add(s);
      prev.events += p.events;
      const newer = p.last && (!prev.last || p.last.block > prev.last.block || (p.last.block === prev.last.block && p.last.logIndex > prev.last.logIndex));
      if (newer) {
        prev.last = p.last;
        if (p.kind === "nft-one") prev.spender = p.spender;
      }
    }
  return out;
}

/** A bare pair with no event (quick check, manual check). */
export function barePair(kind: Kind, token: string, spender: string, source: string, tokenId: bigint | null = null): Pair {
  const p = { kind, token: getAddress(token), spender: getAddress(spender), tokenId };
  return { key: pairKey(p), ...p, last: null, events: 0, source: new Set([source]) };
}

export const MAX_UINT256 = (1n << 256n) - 1n;
export const MAX_UINT160 = (1n << 160n) - 1n;

/** "Unlimited" = the amount wallets use for an open-ended approval (anything at or above 2^255, or Permit2's max). */
export function isUnlimited(kind: Kind, amount: bigint | null): boolean {
  if (amount === null) return false;
  if (kind === "permit2") return amount >= MAX_UINT160 / 2n;
  return amount >= 1n << 255n;
}

/** Current state of one pair after a fresh read. */
export type Current = {
  /** erc20 / permit2: allowance; nft-all: 1 or 0; nft-one: 1 when getApproved still names a spender. */
  amount: bigint | null;
  /** nft-one: the address getApproved returns now. */
  approvedNow?: string | null;
  /** permit2: expiration timestamp (seconds). */
  expiration?: number | null;
  /** The read failed (no code, reverted, not a token). */
  unreadable: boolean;
};

/** True when the pair still grants something right now (expired Permit2 allowances count as closed). */
export function isOpen(p: Pair, c: Current | undefined, nowSec: number): boolean {
  if (!c || c.unreadable || c.amount === null) return false;
  if (p.kind === "nft-one") return Boolean(c.approvedNow && c.approvedNow !== ZERO);
  if (p.kind === "permit2" && c.expiration !== null && c.expiration !== undefined && c.expiration !== 0 && c.expiration < nowSec) return false;
  return c.amount > 0n;
}

export type Hint = { id: string; text: string; tone: "info" | "watch" };

export type SpenderFacts = {
  hasCode: boolean | null;
  labels: number | null;
  flags: number | null;
  knownName?: string | null;
  verified?: boolean | null;
  /** Unix seconds of the spender's creation, when a source knows it. */
  createdAt?: number | null;
};

/**
 * Review hints for one open permission. Hints describe what was read; they are never a verdict about the spender.
 * `changedAt` = unix seconds of the last approval event we found (null when unknown).
 */
export function hintsFor(p: Pair, c: Current, s: SpenderFacts, changedAt: number | null, nowSec: number): Hint[] {
  const out: Hint[] = [];
  if ((p.kind === "erc20" || p.kind === "permit2") && isUnlimited(p.kind, c.amount))
    out.push({ id: "unlimited", text: "Unlimited amount: the spender can move any balance of this token you hold now or later.", tone: "watch" });
  if (p.kind === "nft-all") out.push({ id: "operator", text: "Operator approval: covers every item of this collection you hold, now and later.", tone: "watch" });
  if (s.hasCode === false) out.push({ id: "no-code", text: "The spender has no contract code: it is a plain wallet, so a person can move these tokens directly.", tone: "watch" });
  if (s.flags !== null && s.flags > 0) out.push({ id: "flags", text: `${s.flags} community flag${s.flags === 1 ? "" : "s"} on this spender. Read the reasons before deciding.`, tone: "watch" });
  if (s.verified === false) out.push({ id: "unverified", text: "No published source found on the explorer for this spender.", tone: "watch" });
  if (changedAt !== null) {
    const days = Math.floor((nowSec - changedAt) / 86_400);
    if (days >= 30) out.push({ id: "stale", text: `No change to this permission for ${days} days. If you no longer use the app, you may not need it.`, tone: "info" });
  }
  if (s.createdAt) {
    const age = Math.floor((nowSec - s.createdAt) / 86_400);
    if (age < 7) out.push({ id: "young", text: `The spender contract is ${age} day${age === 1 ? "" : "s"} old.`, tone: "watch" });
  }
  if (s.knownName) out.push({ id: "known", text: `Address listed on this site as ${s.knownName}.`, tone: "info" });
  if (s.labels !== null && s.labels > 0) out.push({ id: "labels", text: `${s.labels} community label${s.labels === 1 ? "" : "s"}.`, tone: "info" });
  if (p.kind === "permit2" && c.expiration) {
    const left = c.expiration - nowSec;
    if (left > 0) out.push({ id: "expires", text: `Expires in ${left > 86_400 ? `${Math.floor(left / 86_400)} days` : `${Math.max(1, Math.floor(left / 3600))} hours`}.`, tone: "info" });
  }
  return out;
}

export type RevokeCall = { to: string; data: string; fn: string; args: string[] };

/** The exact transaction that closes one permission. The wallet signs it; this site never sends anything itself. */
export function revokeCall(p: Pair, permit2: string): RevokeCall {
  switch (p.kind) {
    case "erc20":
      return { to: p.token, data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [p.spender as `0x${string}`, 0n] }), fn: "approve(address spender, uint256 amount)", args: [p.spender, "0"] };
    case "nft-all":
      return { to: p.token, data: encodeFunctionData({ abi: NFT_ABI, functionName: "setApprovalForAll", args: [p.spender as `0x${string}`, false] }), fn: "setApprovalForAll(address operator, bool approved)", args: [p.spender, "false"] };
    case "nft-one":
      return { to: p.token, data: encodeFunctionData({ abi: NFT_ABI, functionName: "approve", args: [ZERO, p.tokenId ?? 0n] }), fn: "approve(address to, uint256 tokenId)", args: [ZERO, (p.tokenId ?? 0n).toString()] };
    case "permit2":
      return {
        to: getAddress(permit2),
        data: encodeFunctionData({ abi: PERMIT2_ABI, functionName: "approve", args: [p.token as `0x${string}`, p.spender as `0x${string}`, 0n, 0] }),
        fn: "approve(address token, address spender, uint160 amount, uint48 expiration)",
        args: [p.token, p.spender, "0", "0"],
      };
  }
}

/** Amount for display: "Unlimited", or the value scaled by decimals with up to 4 fraction digits. */
export function formatAmount(kind: Kind, amount: bigint | null, decimals: number | null): string {
  if (amount === null) return "—";
  if (kind === "nft-all") return amount > 0n ? "All items" : "None";
  if (kind === "nft-one") return amount > 0n ? "One item" : "None";
  if (isUnlimited(kind, amount)) return "Unlimited";
  if (decimals === null) return amount.toString();
  const d = BigInt(decimals);
  const whole = amount / 10n ** d;
  const frac = decimals > 0 ? (amount % 10n ** d).toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "") : "";
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${w}.${frac}` : w;
}

/**
 * Plans a backward log scan: windows of `chunk` blocks from `head` down to `stop` (inclusive), newest first.
 * Each window is [from, to]. The caller shrinks `chunk` when the RPC refuses a range and re-plans from where it is.
 */
export function planWindows(head: number, stop: number, chunk: number): [number, number][] {
  const out: [number, number][] = [];
  if (chunk < 1 || head < stop) return out;
  for (let to = head; to >= stop; to -= chunk) out.push([Math.max(stop, to - chunk + 1), to]);
  return out;
}

/** True when an RPC error message means "range too large" (so a smaller window may work). */
export function isRangeError(message: string): boolean {
  return /range|too (many|large|wide)|limit|exceed|10000|block.*span|query returned more/i.test(message);
}
