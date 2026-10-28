import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, keccak256, toBytes } from "viem";
import { LABELS_ABI } from "./abi";
import { checkName, checkUrl, labelCall, practiceApply, urlHash } from "./labels";

const S = "0x3333333333333333333333333333333333333333";
const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const store = () => ({ labels: {}, flags: {}, order: [] as string[], sigs: [] as string[] });

test("name and link rules match the contract", () => {
  assert.equal(checkName("Swap router"), null);
  assert.notEqual(checkName(""), null);
  assert.notEqual(checkName(" x"), null);
  assert.notEqual(checkName("x "), null);
  assert.notEqual(checkName("x".repeat(33)), null);
  assert.equal(checkName("x".repeat(32)), null);
  assert.notEqual(checkName("café"), null);
  assert.equal(checkUrl(""), null);
  assert.equal(checkUrl("https://a"), null);
  assert.notEqual(checkUrl("http://a.org"), null);
  assert.notEqual(checkUrl("https://"), null);
  assert.notEqual(checkUrl("https://a b"), null);
  assert.notEqual(checkUrl(`https://${"a".repeat(121)}`), null);
  assert.equal(urlHash("https://a"), keccak256(toBytes("https://a")));
  assert.equal(urlHash(""), `0x${"0".repeat(64)}`);
});

test("practice store: one label per wallet, update, remove, flags once", () => {
  const s = store();
  assert.equal(practiceApply(s, { kind: "label", spender: S, author: A, name: "One", category: 1, url: "" }), null);
  assert.equal(practiceApply(s, { kind: "label", spender: S, author: A, name: "Two", category: 2, url: "" }), null);
  assert.equal(practiceApply(s, { kind: "label", spender: S, author: B, name: "Three", category: 2, url: "" }), null);
  const list = (s.labels as Record<string, { name: string }[]>)[S];
  assert.equal(list.length, 2);
  assert.equal(list[0].name, "Two");
  assert.equal(practiceApply(s, { kind: "remove", spender: S, author: A }), null);
  assert.notEqual(practiceApply(s, { kind: "remove", spender: S, author: A }), null);
  assert.equal(practiceApply(s, { kind: "flag", spender: S, author: A, reason: 2 }), null);
  assert.notEqual(practiceApply(s, { kind: "flag", spender: S, author: A, reason: 3 }), null);
  assert.notEqual(practiceApply(s, { kind: "flag", spender: A, author: A, reason: 1 }), null);
  assert.notEqual(practiceApply(s, { kind: "flag", spender: S, author: B, reason: 7 }), null);
  assert.equal(practiceApply(s, { kind: "unflag", spender: S, author: A }), null);
  assert.notEqual(practiceApply(s, { kind: "unflag", spender: S, author: A }), null);
  assert.notEqual(practiceApply(s, { kind: "label", spender: S, author: A, name: "x", category: 9, url: "" }), null);
});

test("labelCall encodes the contract functions", () => {
  const d = decodeFunctionData({ abi: LABELS_ABI, data: labelCall({ kind: "label", spender: S, name: "R", category: 1, url: "https://a" }) as `0x${string}` });
  assert.equal(d.functionName, "setLabel");
  assert.equal(decodeFunctionData({ abi: LABELS_ABI, data: labelCall({ kind: "flag", spender: S, reason: 4 }) as `0x${string}` }).functionName, "flag");
  assert.equal(decodeFunctionData({ abi: LABELS_ABI, data: labelCall({ kind: "unflag", spender: S }) as `0x${string}` }).functionName, "unflag");
  assert.equal(decodeFunctionData({ abi: LABELS_ABI, data: labelCall({ kind: "remove", spender: S }) as `0x${string}` }).functionName, "removeLabel");
});
