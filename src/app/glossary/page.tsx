import { BRAND } from "@/config/brand";
import { JsonLd } from "@/components/JsonLd";
import { PageHero } from "@/components/site/PageHero";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/glossary",
  title: `Glossary | ${BRAND.name}`,
  description: "Plain definitions of the words behind wallet permissions: allowance, spender, operator, Permit2, revoke, call data and more.",
});

const TERMS: [string, string][] = [
  ["Allowance", "The amount of one token a spender may move from your balance, stored inside the token contract. Set with approve, used with transferFrom."],
  ["Spender", "The address you allowed to move your tokens, usually an app's router, vault or marketplace contract. It can also be a plain wallet."],
  ["Unlimited approval", "An allowance set to the largest number the token can store, so it never runs out. Convenient, and it covers tokens you receive later."],
  ["Operator approval", "setApprovalForAll on an NFT collection: one address may move every item you hold in that collection, now and later."],
  ["Single-item approval", "approve(to, tokenId) on an ERC-721: one address may move one item. Cleared automatically when the item is transferred."],
  ["Permit2", "A shared contract many apps use to manage allowances. You approve Permit2 once per token, then Permit2 keeps its own allowances per app, each with an amount and an expiry."],
  ["Revoke", "Setting a permission back to zero or off. It stops future use of that permission; it cannot undo anything that already happened."],
  ["Call data", "The bytes a transaction carries: four bytes that pick the function, then its arguments. Nullo shows it before your wallet opens."],
  ["Approval event", "The log a token writes when an approval changes. Useful to find where to look; the current amount is always read from the token itself."],
  ["Hint", "A fact Nullo read about a permission or spender, such as an unlimited amount or missing contract code. Information for your decision, not a verdict."],
  ["Community label", "A note a wallet attached to a spender in the NulloSpenderLabels contract: a name, a category and an optional link. Always shown with its author."],
  ["Flag", "A wallet's public note that something about a spender looks wrong, with a reason code. Flags are counted and shown; they never hide anything."],
];

export default function GlossaryPage() {
  return (
    <main id="main">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTermSet",
          name: `${BRAND.name} glossary`,
          hasDefinedTerm: TERMS.map(([n, d]) => ({ "@type": "DefinedTerm", name: n, description: d })),
        }}
      />
      <PageHero title="Permissions," tail="defined." lead="Short definitions of the words behind wallet permissions, so the dashboard reads plainly." />
      <section className="nl-page !pt-16">
        <div className="nl-container">
          <div className="flex items-center justify-between">
            <p className="nl-rule m-0">All terms</p>
            <span className="text-[14px] text-[var(--ink-55)]">{TERMS.length} definitions</span>
          </div>
          <div className="nl-terms mt-8">
            {TERMS.map(([n, d], i) => (
              <div key={n} id={n.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="nl-term nl-reveal">
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <h2>{n}</h2>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
