import { NextResponse } from "next/server";
import { allowPublic, tooMany } from "@/lib/guard";
import { getStore } from "@/lib/server/store";
import { tokenList } from "@/lib/server/tokenlist";

export const dynamic = "force-dynamic";

/** Token list for the quick check (addresses + symbols only; allowances are read from the chain). */
export async function GET(request: Request) {
  if (!(await allowPublic(getStore(), request, "tokens", 30, 600))) return tooMany();
  const out = await tokenList();
  return NextResponse.json(out, { headers: { "cache-control": "public, max-age=300" } });
}
