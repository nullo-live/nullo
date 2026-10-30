import { test } from "node:test";
import assert from "node:assert/strict";
import { curveFromRecord, launchedTokenCall } from "./pons";

const word = (hex: string) => hex.replace(/^0x/, "").padStart(64, "0");
const record = (curve: string, exists: boolean) => `0x${Array.from({ length: 15 }, (_, i) => (i === 1 ? word(curve) : i === 14 ? word(exists ? "1" : "0") : word("0"))).join("")}`;

test("getLaunchedToken call data", () => {
  const d = launchedTokenCall("0x4B026eef9b47dcd0dd8675cbfe7b735cfc501b75");
  assert.equal(d, "0x3cf28b5a0000000000000000000000004b026eef9b47dcd0dd8675cbfe7b735cfc501b75");
  assert.throws(() => launchedTokenCall("0x123"));
});

test("curve is read from word 1 only when word 14 says the launch exists", () => {
  // HUMIQ's curve, as read on chain 4663 on 30 Oct 2026.
  assert.equal(curveFromRecord(record("bc9e3de7f19ea7c42e4ad2317b232923dc70393c", true)), "0xbc9E3De7F19ea7C42E4AD2317b232923dc70393C");
  assert.equal(curveFromRecord(record("bc9e3de7f19ea7c42e4ad2317b232923dc70393c", false)), null);
  assert.equal(curveFromRecord(record("0", true)), null);
  assert.equal(curveFromRecord("0x"), null);
  assert.equal(curveFromRecord(null), null);
  assert.equal(curveFromRecord(`0x${"f".repeat(64 * 15)}`), null, "dirty high bits are not an address");
});
