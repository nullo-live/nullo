import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, encodeAbiParameters, getAddress } from "viem";
import { ERC20_ABI, NFT_ABI, PERMIT2_ABI } from "./abi";
import {
  APPROVAL_FOR_ALL_TOPIC,
  APPROVAL_TOPIC,
  MAX_UINT160,
  MAX_UINT256,
  P2_APPROVAL_TOPIC,
  P2_LOCKDOWN_TOPIC,
  barePair,
  decodeLog,
  formatAmount,
  hintsFor,
  isOpen,
  isRangeError,
  isUnlimited,
  mergePairs,
  padTopic,
  pairsFrom,
  planWindows,
  revokeCall,
  type RawLog,
} from "./approvals";

const P2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const OWNER = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";
const SPENDER = "0x3333333333333333333333333333333333333333";
const NFT = "0x4444444444444444444444444444444444444444";
const hex = (n: number) => `0x${n.toString(16)}`;
const log = (over: Partial<RawLog>): RawLog => ({ address: TOKEN, topics: [], data: "0x", blockNumber: hex(100), transactionHash: `0x${"ab".repeat(32)}`, logIndex: "0x0", ...over });

test("padTopic pads and lower-cases; refuses non-addresses", () => {
  assert.equal(padTopic(SPENDER.toUpperCase().replace("0X", "0x")), `0x${"0".repeat(24)}${SPENDER.slice(2)}`);
  assert.throws(() => padTopic("0x12"));
});

test("decodes an ERC-20 Approval", () => {
  const e = decodeLog(log({ topics: [APPROVAL_TOPIC, padTopic(OWNER), padTopic(SPENDER)], data: encodeAbiParameters([{ type: "uint256" }], [5n]) }), P2);
  assert.ok(e);
  assert.equal(e.kind, "erc20");
  assert.equal(e.spender, getAddress(SPENDER));
  assert.equal(e.amount, 5n);
  assert.equal(e.block, 100);
});

test("decodes an ERC-721 single approval and an operator approval", () => {
  const one = decodeLog(log({ address: NFT, topics: [APPROVAL_TOPIC, padTopic(OWNER), padTopic(SPENDER), `0x${"0".repeat(63)}7`] }), P2);
  assert.equal(one?.kind, "nft-one");
  assert.equal(one?.tokenId, 7n);
  const all = decodeLog(log({ address: NFT, topics: [APPROVAL_FOR_ALL_TOPIC, padTopic(OWNER), padTopic(SPENDER)], data: encodeAbiParameters([{ type: "bool" }], [true]) }), P2);
  assert.equal(all?.kind, "nft-all");
  assert.equal(all?.approved, true);
});

test("decodes Permit2 Approval and Lockdown; ignores other Permit2 events and malformed logs", () => {
  const a = decodeLog(log({ address: P2, topics: [P2_APPROVAL_TOPIC, padTopic(OWNER), padTopic(TOKEN), padTopic(SPENDER)], data: encodeAbiParameters([{ type: "uint160" }, { type: "uint48" }], [MAX_UINT160, 1900000000]) }), P2);
  assert.equal(a?.kind, "permit2");
  assert.equal(a?.token, getAddress(TOKEN));
  assert.equal(a?.expiration, 1900000000);
  const l = decodeLog(log({ address: P2, topics: [P2_LOCKDOWN_TOPIC, padTopic(OWNER)], data: encodeAbiParameters([{ type: "address" }, { type: "address" }], [TOKEN, SPENDER]) }), P2);
  assert.equal(l?.lockdown, true);
  assert.equal(l?.amount, 0n);
  assert.equal(decodeLog(log({ address: P2, topics: [APPROVAL_TOPIC, padTopic(OWNER), padTopic(SPENDER)] }), P2), null);
  assert.equal(decodeLog(log({ topics: [APPROVAL_TOPIC, padTopic(OWNER)] }), P2), null);
  assert.equal(decodeLog(log({ topics: [APPROVAL_TOPIC, padTopic(OWNER), padTopic(SPENDER)], data: "0x12" }), P2), null);
});

test("pairsFrom keeps the newest event per pair, whatever the order", () => {
  const mk = (block: number, amount: bigint, idx = 0) => decodeLog(log({ topics: [APPROVAL_TOPIC, padTopic(OWNER), padTopic(SPENDER)], data: encodeAbiParameters([{ type: "uint256" }], [amount]), blockNumber: hex(block), logIndex: hex(idx) }), P2)!;
  const pairs = pairsFrom([mk(300, 1n), mk(100, 9n), mk(300, 2n, 4), mk(200, 3n)]);
  assert.equal(pairs.size, 1);
  const p = [...pairs.values()][0];
  assert.equal(p.events, 4);
  assert.equal(p.last?.amount, 2n);
});

test("single NFT approvals are keyed by token id and follow the newest approved address", () => {
  const mk = (block: number, to: string) => decodeLog(log({ address: NFT, topics: [APPROVAL_TOPIC, padTopic(OWNER), padTopic(to), `0x${"0".repeat(63)}1`], blockNumber: hex(block) }), P2)!;
  const pairs = pairsFrom([mk(10, SPENDER), mk(20, OWNER)]);
  assert.equal(pairs.size, 1);
  assert.equal([...pairs.values()][0].spender, getAddress(OWNER));
});

test("mergePairs unions sources and keeps the newest event", () => {
  const a = pairsFrom([decodeLog(log({ topics: [APPROVAL_TOPIC, padTopic(OWNER), padTopic(SPENDER)], data: encodeAbiParameters([{ type: "uint256" }], [1n]), blockNumber: hex(50) }), P2)!], "logs");
  const b = new Map([[barePair("erc20", TOKEN, SPENDER, "quick").key, barePair("erc20", TOKEN, SPENDER, "quick")]]);
  const m = mergePairs(b, a);
  assert.equal(m.size, 1);
  const p = [...m.values()][0];
  assert.deepEqual([...p.source].sort(), ["logs", "quick"]);
  assert.equal(p.last?.block, 50);
});

test("isUnlimited: max values and 2^255 and above; Permit2 by uint160", () => {
  assert.equal(isUnlimited("erc20", MAX_UINT256), true);
  assert.equal(isUnlimited("erc20", 1n << 255n), true);
  assert.equal(isUnlimited("erc20", 10n ** 30n), false);
  assert.equal(isUnlimited("permit2", MAX_UINT160), true);
  assert.equal(isUnlimited("permit2", 1000n), false);
  assert.equal(isUnlimited("erc20", null), false);
});

test("isOpen reads the current state, not the event", () => {
  const p = barePair("erc20", TOKEN, SPENDER, "x");
  assert.equal(isOpen(p, { amount: 0n, unreadable: false }, 0), false);
  assert.equal(isOpen(p, { amount: 3n, unreadable: false }, 0), true);
  assert.equal(isOpen(p, { amount: 3n, unreadable: true }, 0), false);
  assert.equal(isOpen(p, undefined, 0), false);
  const p2 = barePair("permit2", TOKEN, SPENDER, "x");
  assert.equal(isOpen(p2, { amount: 5n, expiration: 100, unreadable: false }, 200), false);
  assert.equal(isOpen(p2, { amount: 5n, expiration: 300, unreadable: false }, 200), true);
  const one = barePair("nft-one", NFT, SPENDER, "x", 1n);
  assert.equal(isOpen(one, { amount: 1n, approvedNow: "0x0000000000000000000000000000000000000000", unreadable: false }, 0), false);
  assert.equal(isOpen(one, { amount: 1n, approvedNow: SPENDER, unreadable: false }, 0), true);
});

test("hints describe facts and never call a spender safe or unsafe", () => {
  const p = barePair("erc20", TOKEN, SPENDER, "x");
  const now = 1_800_000_000;
  const h = hintsFor(p, { amount: MAX_UINT256, unreadable: false }, { hasCode: false, labels: 2, flags: 1, verified: false, createdAt: now - 86_400 }, now - 40 * 86_400, now);
  const ids = h.map((x) => x.id);
  for (const id of ["unlimited", "no-code", "flags", "unverified", "stale", "young", "labels"]) assert.ok(ids.includes(id), id);
  for (const x of h) assert.doesNotMatch(x.text, /\b(safe|scam|malicious|dangerous)\b/i);
  const quiet = hintsFor(p, { amount: 5n, unreadable: false }, { hasCode: true, labels: 0, flags: 0 }, now - 86_400, now);
  assert.deepEqual(quiet, []);
});

test("revokeCall builds the exact zeroing call for each kind", () => {
  const e = revokeCall(barePair("erc20", TOKEN, SPENDER, "x"), P2);
  assert.equal(e.to, getAddress(TOKEN));
  const d = decodeFunctionData({ abi: ERC20_ABI, data: e.data as `0x${string}` });
  assert.equal(d.functionName, "approve");
  assert.deepEqual(d.args, [getAddress(SPENDER), 0n]);
  assert.ok(e.data.startsWith("0x095ea7b3"));

  const all = revokeCall(barePair("nft-all", NFT, SPENDER, "x"), P2);
  const d2 = decodeFunctionData({ abi: NFT_ABI, data: all.data as `0x${string}` });
  assert.equal(d2.functionName, "setApprovalForAll");
  assert.deepEqual(d2.args, [getAddress(SPENDER), false]);

  const one = revokeCall(barePair("nft-one", NFT, SPENDER, "x", 9n), P2);
  const d3 = decodeFunctionData({ abi: NFT_ABI, data: one.data as `0x${string}` });
  assert.deepEqual(d3.args, ["0x0000000000000000000000000000000000000000", 9n]);

  const p2 = revokeCall(barePair("permit2", TOKEN, SPENDER, "x"), P2);
  assert.equal(p2.to, P2);
  const d4 = decodeFunctionData({ abi: PERMIT2_ABI, data: p2.data as `0x${string}` });
  assert.equal(d4.functionName, "approve");
  assert.deepEqual(d4.args, [getAddress(TOKEN), getAddress(SPENDER), 0n, 0]);
});

test("formatAmount", () => {
  assert.equal(formatAmount("erc20", MAX_UINT256, 18), "Unlimited");
  assert.equal(formatAmount("erc20", 1234500000n, 6), "1,234.5");
  assert.equal(formatAmount("erc20", 7n, null), "7");
  assert.equal(formatAmount("erc20", null, 6), "—");
  assert.equal(formatAmount("nft-all", 1n, null), "All items");
  assert.equal(formatAmount("erc20", 0n, 18), "0");
});

test("planWindows covers the range newest first with no gaps or overlaps", () => {
  const w = planWindows(1000, 1, 300);
  assert.deepEqual(w[0], [701, 1000]);
  assert.deepEqual(w[w.length - 1], [1, 100]);
  let covered = 0;
  for (const [a, b] of w) covered += b - a + 1;
  assert.equal(covered, 1000);
  for (let i = 1; i < w.length; i++) assert.equal(w[i][1], w[i - 1][0] - 1);
  assert.deepEqual(planWindows(5, 10, 3), []);
  assert.deepEqual(planWindows(5, 1, 0), []);
});

test("isRangeError recognises the usual RPC refusals", () => {
  assert.equal(isRangeError("ranges over 10000 blocks are not supported on free plan"), true);
  assert.equal(isRangeError("query returned more than 10000 results"), true);
  assert.equal(isRangeError("block range too large"), true);
  assert.equal(isRangeError("execution reverted"), false);
});
