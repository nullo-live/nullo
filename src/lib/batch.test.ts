import { test } from "node:test";
import assert from "node:assert/strict";
import { atomicSupport, batchId, callsStatus, sendCallsParams } from "./batch";

const RH = "0x1237";

test("capabilities: current shape, draft shape, decimal key, every-chain key", () => {
  assert.equal(atomicSupport({ [RH]: { atomic: { status: "supported" } } }, RH), "supported");
  assert.equal(atomicSupport({ "0X1237": { atomic: { status: "ready" } } }, RH), "ready");
  assert.equal(atomicSupport({ [RH]: { atomic: { status: "unsupported" } } }, RH), "none");
  assert.equal(atomicSupport({ [RH]: { atomicBatch: { supported: true } } }, RH), "supported");
  assert.equal(atomicSupport({ "4663": { atomic: { status: "supported" } } }, RH), "supported");
  assert.equal(atomicSupport({ "0x0": { atomic: { status: "supported" } } }, RH), "supported");
  assert.equal(atomicSupport({ "0x1": { atomic: { status: "supported" } } }, RH), "none", "another chain only");
  assert.equal(atomicSupport(null, RH), "none");
  assert.equal(atomicSupport("yes", RH), "none");
});

test("sendCalls params: atomic, no value, exact calls", () => {
  const [p] = sendCallsParams("0x1111111111111111111111111111111111111111", RH, [{ to: "0x2222222222222222222222222222222222222222", data: "0x095ea7b3" }]);
  assert.equal(p.atomicRequired, true);
  assert.equal(p.chainId, RH);
  assert.equal(p.version, "2.0.0");
  assert.deepEqual(p.calls, [{ to: "0x2222222222222222222222222222222222222222", data: "0x095ea7b3", value: "0x0" }]);
  assert.throws(() => sendCallsParams("0x1111111111111111111111111111111111111111", RH, []));
  assert.throws(() => sendCallsParams("0x1111111111111111111111111111111111111111", RH, [{ to: "0x12", data: "0x" }]));
});

test("batch id from both answer shapes", () => {
  assert.equal(batchId("0xabc"), "0xabc");
  assert.equal(batchId({ id: "abc" }), "abc");
  assert.equal(batchId({}), null);
  assert.equal(batchId(""), null);
});

test("calls status: numeric and draft codes, reverted receipts are failures", () => {
  const h = `0x${"ab".repeat(32)}`;
  assert.equal(callsStatus({ status: 100 }).state, "pending");
  assert.deepEqual(callsStatus({ status: 200, receipts: [{ transactionHash: h, status: "0x1" }] }), { state: "confirmed", hashes: [h], reverted: false });
  assert.equal(callsStatus({ status: 200, receipts: [{ transactionHash: h, status: "0x0" }] }).state, "failed");
  assert.equal(callsStatus({ status: 500 }).state, "failed");
  assert.equal(callsStatus({ status: 400 }).state, "failed");
  assert.equal(callsStatus({ status: "PENDING" }).state, "pending");
  assert.equal(callsStatus({ status: "CONFIRMED", receipts: [{ transactionHash: h, status: "0x1" }] }).state, "confirmed");
  assert.equal(callsStatus(null).state, "pending");
});
