import { BRAND, CHAIN, TOKEN } from "@/config/brand";
import { CONTRACTS, labelsLive } from "@/config/contracts";

export const dynamic = "force-static";

/** Plain-text summary for language models and crawlers. */
export function GET() {
  const lines = [
    `# ${BRAND.name}`,
    "",
    `> ${BRAND.slogan} ${BRAND.tagline}`,
    "",
    `${BRAND.name} reads the token permissions a wallet has given on ${CHAIN.name} (chain id ${CHAIN.id}): ERC-20 allowances, ERC-721/1155 operator approvals, single-NFT approvals and Permit2 allowances. It finds them from approval events (block windows through a read relay), a quick check of popular tokens against known spenders, and optionally the explorer's full history; the current state is always a fresh on-chain read. Each open permission gets factual hints and community labels. Revoking prepares approve(spender, 0), setApprovalForAll(operator, false), approve(0x0, tokenId) or Permit2 approve(token, spender, 0, 0), shows the call data, and the user's own wallet signs it. It does not promise that a wallet is safe.`,
    "",
    "## Pages",
    `- ${BRAND.url}/app: scanner, dashboard, review, revoke queue, history, pair check`,
    `- ${BRAND.url}/labels: community labels and flags for spender addresses`,
    `- ${BRAND.url}/guides: plain guides on approvals`,
    `- ${BRAND.url}/glossary: terms`,
    `- ${BRAND.url}/contract: what the NulloSpenderLabels contract can and cannot do`,
    `- ${BRAND.url}/limits: what the tool can and cannot see`,
    `- ${BRAND.url}/token: ${BRAND.symbol}`,
    "",
    "## Read API",
    `- GET ${BRAND.url}/api/approvals?owner=0x… : open permissions of one owner (token, spender, spenderLabel, kind, amount, unlimited), counts, and which blocks were read. No key, CORS open for GET, cached about 2 minutes.`,
    "",
    "## Contract",
    `- NulloSpenderLabels: ${labelsLive() ? CONTRACTS.labels : "not deployed yet"}`,
    "- setLabel(spender, name <= 32 printable ASCII, category 1..8, url https://… or empty) one per wallet per spender, updatable; removeLabel(spender); flag(spender, reason 1..6) once per wallet; unflag(spender); countsOf, labelsOf, flagOf, spendersFrom. No owner, no fee, never hides anything.",
    "",
    "## Token",
    `- ${BRAND.symbol}: ${TOKEN.isLive ? BRAND.ca : "not launched yet"}. Analytics credits, premium alerts, monitoring and keyed developer access are planned, not live. No promise of value.`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
