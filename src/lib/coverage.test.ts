import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApprovalEvent } from "./approvals";
import { MAX_CURSOR_EVENTS, coveredCount, describeCoverage, fromCursor, gaps, mergeRanges, planGaps, toCursor } from "./coverage";

const OWNER = "0x1111111111111111111111111111111111111111";
const ev = (block: number, over: Partial<ApprovalEvent> = {}): ApprovalEvent => ({
  kind: "erc20",
  token: "0x2222222222222222222222222222222222222222",
  spender: "0x3333333333333333333333333333333333333333",
  amount: (1n << 256n) - 1n,
  approved: null,
  tokenId: null,
  expiration: null,
  block,
  tx: `0x${block.toString(16).padStart(64, "0")}`,
  logIndex: 0,
  ...over,
});

test("ranges merge when they overlap or touch, bad ones are dropped", () => {
  assert.deepEqual(mergeRanges([[10, 20], [21, 30], [5, 8], [25, 40], [50, 49]]), [[5, 8], [10, 40]]);
  assert.deepEqual(mergeRanges([]), []);
});

test("gaps are the missing parts, newest first", () => {
  assert.deepEqual(gaps([[40, 60], [80, 90]], 1, 100), [[91, 100], [61, 79], [1, 39]]);
  assert.deepEqual(gaps([[1, 100]], 1, 100), []);
  assert.deepEqual(gaps([], 5, 9), [[5, 9]]);
  assert.deepEqual(gaps([[0, 200]], 5, 9), []);
  assert.deepEqual(gaps([[1, 3]], 10, 5), []);
});

test("planGaps cuts gaps into windows of at most `size`, never across a gap, and stops at maxWindows", () => {
  const w = planGaps([[61, 79]], 1, 100, 30);
  assert.deepEqual(w, [[80, 100], [31, 60], [1, 30]]);
  for (const [a, b] of w) assert.ok(b - a + 1 <= 30 && !(a <= 79 && b >= 61));
  assert.deepEqual(planGaps([], 1, 100, 30, 2), [[71, 100], [41, 70]]);
  assert.deepEqual(planGaps([], 1, 100, 0), []);
});

test("coverage numbers: covered + missing = window", () => {
  const ranges: [number, number][] = [[90_000_001, 101_000_000]];
  const d = describeCoverage(ranges, 1, 101_000_000);
  assert.equal(d.covered, 11_000_000);
  assert.equal(d.total, 101_000_000);
  assert.equal(d.covered + coveredCount(d.missing, 1, 101_000_000), d.total);
  assert.ok(Math.abs(d.percent - (11 / 101) * 100) < 1e-9);
  assert.equal(describeCoverage([], 10, 9).percent, 100);
});

test("cursor round trip keeps ranges and events (bigints included)", () => {
  const events = [ev(5), ev(7, { kind: "nft-one", amount: null, tokenId: 42n, logIndex: 3 }), ev(9, { kind: "permit2", amount: 5n, expiration: 1_900_000_000, lockdown: true })];
  const c = toCursor(OWNER, [[1, 3], [4, 9]], events, 123);
  const back = fromCursor(JSON.parse(JSON.stringify(c)), OWNER.toUpperCase().replace("0X", "0x"));
  assert.ok(back);
  assert.deepEqual(back.ranges, [[1, 9]]);
  assert.equal(back.at, 123);
  const byBlock = new Map(back.events.map((e) => [e.block, e]));
  assert.equal(byBlock.get(5)!.amount, (1n << 256n) - 1n);
  assert.equal(byBlock.get(7)!.tokenId, 42n);
  assert.equal(byBlock.get(9)!.lockdown, true);
  assert.equal(byBlock.get(9)!.expiration, 1_900_000_000);
});

test("cursor is refused for another owner or any malformed field", () => {
  const c = toCursor(OWNER, [[1, 9]], [ev(5)]);
  assert.equal(fromCursor(c, "0x4444444444444444444444444444444444444444"), null);
  assert.equal(fromCursor(null, OWNER), null);
  assert.equal(fromCursor({ ...c, v: 2 }, OWNER), null);
  assert.equal(fromCursor({ ...c, ranges: [[9, 1]] }, OWNER), null);
  assert.equal(fromCursor({ ...c, ranges: [[1.5, 3]] }, OWNER), null);
  assert.equal(fromCursor({ ...c, events: [{ ...c.events[0], t: "0xnope" }] }, OWNER), null);
  assert.equal(fromCursor({ ...c, events: [{ ...c.events[0], k: "erc777" }] }, OWNER), null);
  assert.equal(fromCursor({ ...c, events: [{ ...c.events[0], a: "-1" }] }, OWNER)?.events[0].amount, null);
});

test("cursor keeps the newest events when there are too many", () => {
  const many = Array.from({ length: MAX_CURSOR_EVENTS + 10 }, (_, i) => ev(i + 1));
  const c = toCursor(OWNER, [[1, many.length]], many);
  assert.equal(c.events.length, MAX_CURSOR_EVENTS);
  assert.equal(Math.min(...c.events.map((e) => e.b)), 11);
});
