import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData } from "viem";
import { MULTICALL3, PERMIT2 } from "@/config/brand";
import { ERC20_ABI, MULTICALL3_ABI, NFT_ABI, PERMIT2_ABI } from "./abi";
import { APPROVAL_FOR_ALL_TOPIC, APPROVAL_TOPIC, P2_APPROVAL_TOPIC, P2_LOCKDOWN_TOPIC, P2_PERMIT_TOPIC, padTopic } from "./approvals";
import { MAX_MULTICALL, checkBatch, checkMulticall, isTokenRead, logShape, type Call } from "./relay";

const OWNER = "0x1111111111111111111111111111111111111111";
const ANY = "0x2222222222222222222222222222222222222222";
const LAB = "0x00000000000000000000000000000000000abe15";
const owner = padTopic(OWNER);
const logs = (f: Record<string, unknown>): Call => ({ method: "eth_getLogs", params: [f] });
const range = { fromBlock: "0x100", toBlock: "0x200" };
const allowance = encodeFunctionData({ abi: ERC20_ABI, functionName: "allowance", args: [OWNER, ANY] });

test("token reads to any address pass with a low gas cap; other calls do not", () => {
  const tx: Record<string, unknown> = { to: ANY, data: allowance };
  const out = checkBatch([{ method: "eth_call", params: [tx, "latest"] }]);
  assert.ok("units" in out);
  assert.ok(Number(BigInt(tx.gas as string)) <= 200_000);
  assert.ok("error" in checkBatch([{ method: "eth_call", params: [{ to: ANY, data: allowance, gas: "0x2dc6c0" }, "latest"] }]));
  const transfer = encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [ANY, 0n] });
  assert.ok("error" in checkBatch([{ method: "eth_call", params: [{ to: ANY, data: transfer }, "latest"] }]));
  assert.equal(isTokenRead(`${allowance}00`), false);
  assert.equal(isTokenRead(encodeFunctionData({ abi: NFT_ABI, functionName: "getApproved", args: [5n] })), true);
});

test("calls with value are refused", () => {
  assert.ok("error" in checkBatch([{ method: "eth_call", params: [{ to: ANY, data: allowance, value: "0x1" }, "latest"] }]));
});

test("multicall passes only when every inner call is a read", () => {
  const mc = (calls: { target: `0x${string}`; allowFailure: boolean; callData: `0x${string}` }[]) => encodeFunctionData({ abi: MULTICALL3_ABI, functionName: "aggregate3", args: [calls] });
  const p2read = encodeFunctionData({ abi: PERMIT2_ABI, functionName: "allowance", args: [OWNER, ANY, ANY] });
  const good = mc([
    { target: ANY, allowFailure: true, callData: allowance },
    { target: PERMIT2 as `0x${string}`, allowFailure: true, callData: p2read },
  ]);
  assert.equal(checkMulticall(good, LAB), null);
  assert.ok("units" in checkBatch([{ method: "eth_call", params: [{ to: MULTICALL3, data: good }, "latest"] }]));
  const bad = mc([{ target: ANY, allowFailure: true, callData: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [ANY, 1n] }) }]);
  assert.notEqual(checkMulticall(bad, LAB), null);
  const nested = mc([{ target: MULTICALL3 as `0x${string}`, allowFailure: true, callData: "0x18160ddd" }]);
  assert.notEqual(checkMulticall(nested, LAB), null);
  const tooMany = mc(Array.from({ length: MAX_MULTICALL + 1 }, () => ({ target: ANY as `0x${string}`, allowFailure: true, callData: allowance })));
  assert.notEqual(checkMulticall(tooMany, LAB), null);
  assert.notEqual(checkMulticall("0x252dba42", LAB), null);
});

test("approval log shape: no address, approval events, exactly one owner", () => {
  assert.deepEqual(logShape(undefined, [[APPROVAL_TOPIC, APPROVAL_FOR_ALL_TOPIC], owner], LAB), { shape: "owner" });
  assert.deepEqual(logShape(undefined, [APPROVAL_TOPIC, owner], LAB), { shape: "owner" });
  assert.ok("error" in logShape(undefined, [APPROVAL_TOPIC], LAB), "owner required");
  assert.ok("error" in logShape(undefined, [APPROVAL_TOPIC, null], LAB));
  assert.ok("error" in logShape(undefined, [APPROVAL_TOPIC, [owner, padTopic(ANY)]], LAB), "one owner only");
  assert.ok("error" in logShape(undefined, [APPROVAL_TOPIC, owner, owner], LAB), "no third topic");
  assert.ok("error" in logShape(undefined, [`0x${"ab".repeat(32)}`, owner], LAB), "other events");
  assert.ok("error" in logShape(undefined, [], LAB));
  assert.ok("error" in logShape(ANY, [APPROVAL_TOPIC, owner], LAB), "token address filter is not a site shape");
});

test("Permit2 and labels shapes", () => {
  assert.deepEqual(logShape(PERMIT2, [P2_APPROVAL_TOPIC, owner], LAB), { shape: "permit2" });
  assert.ok("error" in logShape(PERMIT2, [APPROVAL_TOPIC, owner], LAB));
  assert.ok("error" in logShape([PERMIT2, ANY], [P2_APPROVAL_TOPIC, owner], LAB));
  const labeled = "0x" + "0".repeat(64);
  assert.ok("error" in logShape(LAB, [labeled], LAB), "unknown event");
});

test("approval log windows: up to 30,000 blocks, priced by 5,000-block steps, three per batch", () => {
  const ok = checkBatch([logs({ topics: [APPROVAL_TOPIC, owner], fromBlock: "0x1", toBlock: "0x7530" })]);
  assert.ok("units" in ok && ok.units === 10 + 6);
  assert.ok("error" in checkBatch([logs({ topics: [APPROVAL_TOPIC, owner], fromBlock: "0x1", toBlock: "0x7531" })]), "30,001 blocks refused");
  assert.ok("error" in checkBatch([logs({ topics: [APPROVAL_TOPIC, owner], fromBlock: "0x1", toBlock: "latest" })]));
  assert.ok("units" in checkBatch([logs({ topics: [APPROVAL_TOPIC, owner], ...range })]));
  const w = (i: number) => logs({ topics: [APPROVAL_TOPIC, owner], fromBlock: `0x${(i * 30000 + 1).toString(16)}`, toBlock: `0x${(i * 30000 + 30000).toString(16)}` });
  const three = [0, 1, 2].map(w);
  assert.ok("units" in checkBatch(three));
  assert.ok("error" in checkBatch([...three, logs({ topics: [APPROVAL_TOPIC, owner], ...range })]), "a fourth query is refused");
});

test("one owner query may name token approvals and Permit2 events together", () => {
  const all = [APPROVAL_TOPIC, APPROVAL_FOR_ALL_TOPIC, P2_APPROVAL_TOPIC, P2_PERMIT_TOPIC, P2_LOCKDOWN_TOPIC];
  assert.deepEqual(logShape(undefined, [all, owner], LAB), { shape: "owner" });
  assert.ok("error" in logShape(undefined, [[...all, `0x${"ab".repeat(32)}`], owner], LAB), "no other events");
  assert.ok("error" in logShape(undefined, [all], LAB), "owner still required");
});

test("a multicall is priced by its number of inner reads", () => {
  const mc = (n: number) => encodeFunctionData({ abi: MULTICALL3_ABI, functionName: "aggregate3", args: [Array.from({ length: n }, () => ({ target: ANY as `0x${string}`, allowFailure: true, callData: allowance }))] });
  const one = checkBatch([{ method: "eth_call", params: [{ to: MULTICALL3, data: mc(1) }, "latest"] }]);
  const full = checkBatch([{ method: "eth_call", params: [{ to: MULTICALL3, data: mc(MAX_MULTICALL) }, "latest"] }]);
  assert.ok("units" in one && one.units === 2 + 1);
  assert.ok("units" in full && full.units === 2 + MAX_MULTICALL / 20);
});
