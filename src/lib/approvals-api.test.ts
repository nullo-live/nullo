import { test } from "node:test";
import assert from "node:assert/strict";
import { barePair, type Current } from "./approvals";
import { buildAnswer, contiguousFrom, parseApprovalsQuery, type ApiCoverage } from "./approvals-api";

const OWNER = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";
const SP = "0x3333333333333333333333333333333333333333";
const q = (s: string) => parseApprovalsQuery(new URLSearchParams(s));

test("query: exactly one valid owner and nothing else", () => {
  assert.deepEqual(q(`owner=${OWNER}`), { owner: OWNER });
  assert.deepEqual(q("owner=0xd6d35b56237a05afd4cd7e441226fefc3f78c4e6"), { owner: "0xD6D35B56237a05aFd4Cd7e441226fefC3f78c4E6" });
  for (const bad of ["", "owner=", "owner=0x123", `owner=${OWNER}&owner=${OWNER}`, `owner=${OWNER}&spender=${SP}`, `owner=${OWNER}0`, "owner=0x0000000000000000000000000000000000000000", `owner= ${OWNER}`, `owner=${OWNER.replace("0x", "0X")}`]) {
    assert.ok("error" in q(bad), bad);
  }
});

const coverage: ApiCoverage = { fromBlock: 10, toBlock: 20, source: "rpc", ranges: [[10, 20]], missingBlocks: 9, quickCheck: { tokens: 1, pairs: 1 }, notes: [] };

test("answer lists only open pairs, with decimal amounts and unlimited counted", () => {
  const unl = barePair("erc20", TOKEN, SP, "quick");
  const small = barePair("permit2", TOKEN, SP, "logs");
  const closed = barePair("erc20", TOKEN, OWNER.replace(/1/g, "4"), "logs");
  const op = barePair("nft-all", TOKEN, SP, "logs");
  const one = barePair("nft-one", TOKEN, "0x0000000000000000000000000000000000000000", "manual", 7n);
  const cur = new Map<string, Current>([
    [unl.key, { amount: (1n << 256n) - 1n, unreadable: false }],
    [small.key, { amount: 5n, expiration: 0, unreadable: false }],
    [closed.key, { amount: 0n, unreadable: false }],
    [op.key, { amount: 1n, unreadable: false }],
    [one.key, { amount: 1n, approvedNow: SP, unreadable: false }],
  ]);
  const a = buildAnswer({ owner: OWNER, pairs: [small, closed, unl, op, one], current: cur, symbols: new Map([[TOKEN, "TKN"]]), label: (s) => (s.toLowerCase() === SP ? "Router" : null), coverage, nowSec: 1000 });
  assert.equal(a.counts.open, 4);
  assert.equal(a.counts.unlimited, 2, "unlimited allowance + operator");
  const u = a.approvals.find((x) => x.kind === "erc20")!;
  assert.equal(u.amount, ((1n << 256n) - 1n).toString());
  assert.equal(u.unlimited, true);
  assert.equal(u.spenderLabel, "Router");
  assert.equal(u.tokenSymbol, "TKN");
  const p2 = a.approvals.find((x) => x.kind === "permit2")!;
  assert.equal(p2.amount, "5");
  assert.equal(p2.unlimited, false);
  assert.equal(p2.expiration, 0);
  const n1 = a.approvals.find((x) => x.kind === "nft-one")!;
  assert.equal(n1.spender, SP, "single-item spender is the one getApproved names now");
  assert.equal(n1.tokenId, "7");
  assert.equal(n1.amount, null);
  assert.ok(a.approvals[0].unlimited, "unlimited first");
  assert.ok(!a.approvals.some((x) => x.spender.startsWith("0x4444")));
  assert.equal(JSON.parse(JSON.stringify(a)).counts.open, 4, "serialisable (no bigint)");
});

test("expired Permit2 allowances are not listed", () => {
  const p = barePair("permit2", TOKEN, SP, "quick");
  const a = buildAnswer({ owner: OWNER, pairs: [p], current: new Map([[p.key, { amount: 9n, expiration: 999, unreadable: false }]]), symbols: new Map(), label: () => null, coverage, nowSec: 1000 });
  assert.equal(a.counts.open, 0);
});

test("contiguous range reaching the head", () => {
  assert.equal(contiguousFrom([[1, 5], [10, 20]], 20), 10);
  assert.equal(contiguousFrom([[1, 5], [10, 19]], 20), null);
  assert.equal(contiguousFrom([], 20), null);
});
