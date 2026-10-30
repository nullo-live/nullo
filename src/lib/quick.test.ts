import { test } from "node:test";
import assert from "node:assert/strict";
import { getAddress } from "viem";
import { KNOWN_SPENDERS, PERMIT2, knownSpenderName } from "@/config/spenders";
import { padTopic, PERMIT2_TOPICS, TOKEN_TOPICS, type RawLog } from "./approvals";
import { quickPairs, scanCoverage, type WindowFetch } from "./scan";

const T1 = "0x2222222222222222222222222222222222222222";
const T2 = "0x5555555555555555555555555555555555555555";
const CURVE = "0x6666666666666666666666666666666666666666";
const OWNER = "0x1111111111111111111111111111111111111111";

test("known spenders: checksummed, distinct, confirmed, Permit2 listed", () => {
  const seen = new Set<string>();
  for (const s of KNOWN_SPENDERS) {
    assert.equal(getAddress(s.address), s.address, `${s.name} checksum`);
    assert.ok(!seen.has(s.address.toLowerCase()), `${s.name} repeated`);
    seen.add(s.address.toLowerCase());
    assert.ok(s.how.length > 10);
  }
  assert.ok(seen.has(PERMIT2.toLowerCase()));
  assert.ok(KNOWN_SPENDERS.length >= 15);
});

test("quick pairs: every token x every spender, Permit2 only for Permit2 users, plus the Pons curve", () => {
  const pairs = quickPairs([{ address: T1, curve: CURVE }, { address: T2 }, { address: T1 }, { address: "nope" }]);
  const plain = pairs.filter((p) => p.kind === "erc20");
  const viaP2 = pairs.filter((p) => p.kind === "permit2");
  const p2users = KNOWN_SPENDERS.filter((s) => s.permit2).length;
  assert.equal(plain.length, 2 * KNOWN_SPENDERS.length + 1);
  assert.equal(viaP2.length, 2 * p2users);
  assert.ok(plain.some((p) => p.token.toLowerCase() === T1 && p.spender.toLowerCase() === CURVE));
  assert.ok(!plain.some((p) => p.token.toLowerCase() === T2 && p.spender.toLowerCase() === CURVE));
  assert.ok(!viaP2.some((p) => p.spender.toLowerCase() === PERMIT2.toLowerCase()), "Permit2 never spends through itself");
  assert.equal(new Set(pairs.map((p) => p.key)).size, pairs.length, "no repeated pairs");
});

test("spender names: list first, then Pons curves", () => {
  assert.equal(knownSpenderName(PERMIT2.toLowerCase()), "Permit2 (Uniswap)");
  assert.equal(knownSpenderName(CURVE, new Map([[CURVE, "HUMIQ"]])), "Pons bonding curve (HUMIQ)");
  assert.equal(knownSpenderName(CURVE), null);
});

const approvalLog = (block: number): RawLog => ({
  address: T1,
  topics: [TOKEN_TOPICS[0], padTopic(OWNER), padTopic(CURVE)],
  data: `0x${"f".repeat(64)}`,
  blockNumber: `0x${block.toString(16)}`,
  transactionHash: `0x${block.toString(16).padStart(64, "0")}`,
  logIndex: "0x0",
});

test("coverage scan: one query per window with token + Permit2 topics, skips covered blocks, shrinks on range refusals", async () => {
  const seen: [number, number][] = [];
  let topicsOk = true;
  const fetchWindow: WindowFetch = async (topics, from, to) => {
    topicsOk &&= topics[0].length === TOKEN_TOPICS.length + PERMIT2_TOPICS.length && topics[1] === padTopic(OWNER);
    if (to - from + 1 > 10_000) return { range: true, message: "ranges over 10000 blocks are not supported" };
    seen.push([from, to]);
    return { logs: from <= 95_000 && 95_000 <= to ? [approvalLog(95_000)] : [] };
  };
  const r = await scanCoverage(OWNER, 1, 100_000, [[40_001, 60_000]], () => undefined, { stopped: false }, { fetchWindow, concurrency: 2 });
  assert.ok(topicsOk);
  assert.equal(r.error, null);
  assert.deepEqual(r.ranges, [[1, 40_000], [60_001, 100_000]]);
  assert.ok(seen.every(([a, b]) => b < 40_001 || a > 60_000), "covered blocks are not read again");
  assert.ok(seen.every(([a, b]) => b - a + 1 <= 10_000));
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].spender.toLowerCase(), CURVE);
});

test("coverage scan: a budget answer pauses and keeps what was read; maxWindows bounds a call", async () => {
  let n = 0;
  const fetchWindow: WindowFetch = async () => (++n > 2 ? { fatal: "busy", paused: true } : { logs: [] });
  const r = await scanCoverage(OWNER, 1, 200_000, [], () => undefined, { stopped: false }, { fetchWindow, concurrency: 1 });
  assert.equal(r.paused, true);
  assert.deepEqual(r.ranges, [[140_001, 200_000]]);
  const b = await scanCoverage(OWNER, 1, 200_000, [], () => undefined, { stopped: false }, { fetchWindow: async () => ({ logs: [] }), maxWindows: 3, concurrency: 3 });
  assert.deepEqual(b.ranges, [[110_001, 200_000]]);
});

test("coverage scan: busy answers are retried in place, not shrunk; a long busy run pauses", async () => {
  let calls = 0;
  const flaky: WindowFetch = async (_t, from, to) => (++calls % 2 ? { busy: true, message: "RPC 429: Too Many Requests" } : to - from + 1 <= 30_000 ? { logs: [] } : { range: true, message: "range" });
  const r = await scanCoverage(OWNER, 1, 60_000, [], () => undefined, { stopped: false }, { fetchWindow: flaky, concurrency: 1 });
  assert.equal(r.error, null);
  assert.deepEqual(r.ranges, [[1, 60_000]]);
  assert.equal(r.queries, 2, "windows kept their 30,000-block size");
  const stuck = await scanCoverage(OWNER, 1, 60_000, [], () => undefined, { stopped: false }, { fetchWindow: async () => ({ busy: true, message: "429" }), concurrency: 1 });
  assert.equal(stuck.paused, true);
  assert.deepEqual(stuck.ranges, []);
});

test("coverage scan: a window refused even at the smallest size is skipped and older blocks are still read", async () => {
  const fetchWindow: WindowFetch = async (_t, from, to) => (from <= 50_000 && 50_000 <= to ? { range: true, message: "too many results" } : { logs: from <= 10_000 && 10_000 <= to ? [approvalLog(10_000)] : [] });
  const r = await scanCoverage(OWNER, 1, 100_000, [], () => undefined, { stopped: false }, { fetchWindow, concurrency: 1 });
  assert.equal(r.error, null);
  assert.equal(r.skipped.length, 1);
  assert.ok(r.skipped[0][0] <= 50_000 && 50_000 <= r.skipped[0][1] && r.skipped[0][1] - r.skipped[0][0] < 100);
  assert.equal(r.events.length, 1, "blocks older than the skipped window were read");
  assert.equal(r.ranges[0][0], 1);
});
