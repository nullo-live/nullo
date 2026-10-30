import { NextResponse } from "next/server";
import { parseApprovalsQuery } from "@/lib/approvals-api";
import { allowPublic } from "@/lib/guard";
import { ANSWER_TTL, ownerApprovals } from "@/lib/server/approvals";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/*
 * GET /api/approvals?owner=0x…  — open token permissions of one owner on Robinhood Chain, read at the latest block.
 * Read-only, no key, CORS open for GET so other sites (FLIQO first) can call it from the browser.
 * Answer: { owner, approvals: [{ token, tokenSymbol, spender, spenderLabel, kind, amount, unlimited, tokenId,
 * expiration, foundBy }], counts: { open, unlimited }, coverage: { fromBlock, toBlock, source, ranges, missingBlocks,
 * quickCheck, notes }, generatedAt, cached }. Shape: src/lib/approvals-api.ts; reads: src/lib/server/approvals.ts.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "600",
};

const json = (body: unknown, status: number, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...CORS, ...extra } });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const q = parseApprovalsQuery(new URL(request.url).searchParams);
  if ("error" in q) return json({ error: q.error }, 400, { "cache-control": "no-store" });
  if (!(await allowPublic(getStore(), request, "approvals", 12, 240))) return json({ error: "Too many requests. Slow down a little." }, 429, { "retry-after": "60", "cache-control": "no-store" });
  try {
    const answer = await ownerApprovals(q.owner);
    return json(answer, 200, { "cache-control": `public, max-age=30, s-maxage=${ANSWER_TTL}` });
  } catch {
    return json({ error: "The chain could not be reached. Try again shortly." }, 502, { "cache-control": "no-store" });
  }
}
