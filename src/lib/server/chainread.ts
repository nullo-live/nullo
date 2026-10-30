import "server-only";
import { decodeFunctionResult, encodeFunctionData } from "viem";
import { MULTICALL3, PONS } from "@/config/brand";
import { MULTICALL3_ABI } from "@/lib/abi";
import { rpc } from "@/lib/feeds/rpc";
import { curveFromRecord, launchedTokenCall } from "@/lib/pons";
import type { MulticallExec } from "@/lib/scan";
import { getStore } from "@/lib/server/store";

/*
 * Server-side chain reads shared by /api/tokens and /api/approvals: Multicall3 straight to the server RPC (not the
 * browser relay) and the Pons curve of each token. A Pons launch record never changes, so curves are cached for a
 * week in Redis (plain GET / SET EX, keys "nullo:pons:curve:<token>") and in this instance's memory.
 */

export const serverExec: MulticallExec = (data) => rpc<`0x${string}`>("eth_call", [{ to: MULTICALL3, data }, "latest"]);

const memo = new Map<string, string | null>();
const CURVE_TTL = 7 * 86_400;
const NONE = "-";

/** Pons V2 curve of each token (null when not a Pons launch). Unknown answers are left out, never guessed. */
export async function ponsCurves(tokens: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const want = [...new Set(tokens.map((t) => t.toLowerCase()))].filter((t) => /^0x[0-9a-f]{40}$/.test(t));
  const store = getStore();
  const todo: string[] = [];
  for (const t of want) {
    if (memo.has(t)) out.set(t, memo.get(t)!);
    else todo.push(t);
  }
  if (store && todo.length) {
    const hits = await store.mget(todo.map((t) => `pons:curve:${t}`)).catch(() => todo.map(() => null));
    for (let i = todo.length - 1; i >= 0; i--) {
      const v = hits[i];
      if (typeof v === "string" && (v === NONE || /^0x[0-9a-fA-F]{40}$/.test(v))) {
        const curve = v === NONE ? null : v;
        memo.set(todo[i], curve);
        out.set(todo[i], curve);
        todo.splice(i, 1);
      }
    }
  }
  for (let i = 0; i < todo.length; i += 100) {
    const chunk = todo.slice(i, i + 100);
    try {
      const data = encodeFunctionData({ abi: MULTICALL3_ABI, functionName: "aggregate3", args: [chunk.map((t) => ({ target: PONS.factory as `0x${string}`, allowFailure: true, callData: launchedTokenCall(t) }))] });
      const res = decodeFunctionResult({ abi: MULTICALL3_ABI, functionName: "aggregate3", data: await serverExec(data) }) as readonly { success: boolean; returnData: `0x${string}` }[];
      chunk.forEach((t, k) => {
        const r = res[k];
        // Only a full launch record is an answer; a short one (no code, wrong chain) is not cached.
        if (!r?.success || r.returnData.length < 2 + 15 * 64) return;
        const curve = curveFromRecord(r.returnData);
        if (memo.size > 5000) memo.clear();
        memo.set(t, curve);
        out.set(t, curve);
        store?.setEx(`pons:curve:${t}`, curve ?? NONE, CURVE_TTL).catch(() => undefined);
      });
    } catch {
      // The chain did not answer: these tokens simply get no curve read this time.
    }
  }
  return out;
}
