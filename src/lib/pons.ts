import { getAddress } from "viem";
import { PONS } from "@/config/spenders";

/*
 * Pons V2 launch records, free of I/O. factory.getLaunchedToken(token) returns a static tuple of 15 words: the
 * token's own bonding curve is word 1 and `exists` is word 14 (checked on chain 4663 against three known launches,
 * 30 Oct 2026). A curve is a spender: selling on it needs an ERC-20 approval to that curve.
 */

const ZERO = "0x0000000000000000000000000000000000000000";

/** Call data for factory.getLaunchedToken(token). */
export function launchedTokenCall(token: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(token)) throw new Error("not an address");
  return `${PONS.getLaunchedToken}${token.slice(2).toLowerCase().padStart(64, "0")}` as `0x${string}`;
}

/** The curve of a Pons launch, or null when the token was not launched through Pons V2 (or the answer is short). */
export function curveFromRecord(hex: string | null | undefined): string | null {
  if (typeof hex !== "string" || !/^0x[0-9a-fA-F]*$/.test(hex) || hex.length < 2 + 15 * 64) return null;
  const word = (i: number) => hex.slice(2 + i * 64, 2 + (i + 1) * 64);
  if (BigInt(`0x${word(14)}`) !== 1n) return null;
  const w1 = word(1);
  if (!/^0{24}/.test(w1)) return null;
  const curve = getAddress(`0x${w1.slice(24)}`);
  return curve === ZERO ? null : curve;
}
