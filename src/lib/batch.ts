/*
 * EIP-5792 (wallet_getCapabilities / wallet_sendCalls / wallet_getCallsStatus), free of I/O. When the wallet says it
 * can run calls atomically on Robinhood Chain, the revoke queue offers one signature for every row; the calls are
 * the same exact revokes the queue shows. Anything else (no support, an unknown answer) keeps the one-by-one queue.
 * Both the current shape (`atomic.status`, numeric call status) and the earlier draft (`atomicBatch.supported`,
 * "PENDING"/"CONFIRMED") are read.
 */

export type BatchSupport = "ready" | "supported" | "none";

/** Reads a wallet_getCapabilities answer for one chain (hex id). */
export function atomicSupport(caps: unknown, chainHex: string): BatchSupport {
  if (!caps || typeof caps !== "object") return "none";
  const all = caps as Record<string, unknown>;
  const lower = Object.fromEntries(Object.entries(all).map(([k, v]) => [k.toLowerCase(), v]));
  const id = chainHex.toLowerCase();
  // Some wallets key by decimal id; "0x0" holds capabilities that apply to every chain.
  const c = (lower[id] ?? lower[String(Number(BigInt(chainHex)))] ?? lower["0x0"]) as Record<string, unknown> | undefined;
  if (!c || typeof c !== "object") return "none";
  const atomic = c.atomic as { status?: unknown } | undefined;
  if (atomic && typeof atomic === "object") {
    if (atomic.status === "supported") return "supported";
    if (atomic.status === "ready") return "ready";
    return "none";
  }
  const draft = c.atomicBatch as { supported?: unknown } | undefined;
  return draft && draft.supported === true ? "supported" : "none";
}

export type BatchCall = { to: string; data: string };

/** Params for wallet_sendCalls: every call atomic, no value, on Robinhood Chain. */
export function sendCallsParams(from: string, chainHex: string, calls: BatchCall[]) {
  if (calls.length === 0) throw new Error("Nothing to send.");
  for (const c of calls) if (!/^0x[0-9a-fA-F]{40}$/.test(c.to) || !/^0x[0-9a-fA-F]*$/.test(c.data)) throw new Error("Bad call in batch.");
  return [{ version: "2.0.0", from, chainId: chainHex, atomicRequired: true, calls: calls.map((c) => ({ to: c.to, data: c.data, value: "0x0" })) }];
}

/** The batch id from a wallet_sendCalls answer (string in the draft, { id } now). */
export function batchId(answer: unknown): string | null {
  if (typeof answer === "string" && answer.length > 0 && answer.length <= 512) return answer;
  const id = (answer as { id?: unknown } | null)?.id;
  return typeof id === "string" && id.length > 0 && id.length <= 512 ? id : null;
}

export type BatchState = { state: "pending" | "confirmed" | "failed"; hashes: string[]; reverted: boolean };

/** Reads a wallet_getCallsStatus answer. */
export function callsStatus(answer: unknown): BatchState {
  const a = (answer ?? {}) as { status?: unknown; receipts?: unknown };
  const receipts = Array.isArray(a.receipts) ? (a.receipts as { transactionHash?: unknown; status?: unknown }[]) : [];
  const hashes = [...new Set(receipts.map((r) => r?.transactionHash).filter((h): h is string => typeof h === "string" && /^0x[0-9a-fA-F]{64}$/.test(h)))];
  const reverted = receipts.some((r) => r?.status === "0x0" || r?.status === 0);
  const s = a.status;
  if (typeof s === "number") {
    if (s >= 100 && s < 200) return { state: "pending", hashes, reverted };
    if (s >= 200 && s < 300) return { state: reverted ? "failed" : "confirmed", hashes, reverted };
    return { state: "failed", hashes, reverted: reverted || s >= 500 };
  }
  if (s === "PENDING") return { state: "pending", hashes, reverted };
  if (s === "CONFIRMED") return { state: reverted ? "failed" : "confirmed", hashes, reverted };
  return { state: "pending", hashes, reverted };
}
