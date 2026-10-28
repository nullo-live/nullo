import { NextResponse } from "next/server";
import { isAddress } from "@/config/brand";
import { allowPublic, tooMany } from "@/lib/guard";
import { blockscoutConfigured, ownerHistory, sourceInfo } from "@/lib/server/blockscout";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/*
 * Optional Blockscout source (BLOCKSCOUT_API_KEY, server only):
 *   GET /api/explorer                       -> { configured }
 *   GET /api/explorer?op=history&owner=0x…  -> approval-type logs of that owner over the whole chain
 *   GET /api/explorer?op=source&address=0x… -> whether the explorer lists published source for that address
 * Without the key the answers say configured: false and nothing is fetched.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const op = url.searchParams.get("op");
  if (!op) return NextResponse.json({ configured: blockscoutConfigured() });
  if (!blockscoutConfigured()) return NextResponse.json({ configured: false });
  const store = getStore();
  try {
    if (op === "history") {
      const owner = url.searchParams.get("owner") ?? "";
      if (!isAddress(owner)) return NextResponse.json({ error: "owner must be an address" }, { status: 400 });
      if (!(await allowPublic(store, request, "bs-history", 6, 120))) return tooMany();
      return NextResponse.json(await ownerHistory(owner), { headers: { "cache-control": "no-store" } });
    }
    if (op === "source") {
      const address = url.searchParams.get("address") ?? "";
      if (!isAddress(address)) return NextResponse.json({ error: "address must be an address" }, { status: 400 });
      if (!(await allowPublic(store, request, "bs-source", 60, 1200))) return tooMany();
      return NextResponse.json(await sourceInfo(address));
    }
  } catch {
    return NextResponse.json({ configured: true, error: "Blockscout did not answer. Chain reads still work." }, { status: 502 });
  }
  return NextResponse.json({ error: "unknown op" }, { status: 400 });
}
