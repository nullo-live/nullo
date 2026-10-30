import { ASSETS } from "@/config/assets";
import { BRAND, CHAIN, LAUNCHPAD, TOKEN } from "@/config/brand";
import { CaRow } from "@/components/site/CaCopy";
import { LiveLine } from "@/components/home/LiveLine";
import { PageHero } from "@/components/site/PageHero";
import { TokenFacts } from "@/components/token/TokenFacts";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/token",
  title: `${BRAND.name} (${BRAND.symbol}) Token`,
  description: `${BRAND.symbol} on ${CHAIN.name}: the contract address, live supply once launched, and the planned uses: analytics credits, premium alerts, monitoring and a developer API.`,
});

const PLANNED = [
  { t: "Analytics credits", p: "Deeper history scans and reports across many addresses. Planned; today every scan in the app is free." },
  { t: "Approval alerts", p: "A notice when one of your permissions changes or a spender you use gets flagged. Planned; today you re-scan when you want." },
  { t: "Monitoring", p: "Watch a list of addresses, such as a team treasury, without opening the app. Planned." },
  { t: "Developer API", p: "Higher limits and alerts for wallets and tools. Planned. The free read endpoint /api/approvals is already open to everyone, and everything is readable from the chain directly." },
];

export default function TokenPage() {
  return (
    <main id="main">
      <PageHero title={BRAND.name} tail={`${BRAND.symbol} token.`} lead={`${CHAIN.name} · ${TOKEN.isLive ? "launched" : "not launched yet"}`}>
        <div className="nl-reveal mt-8 grid max-w-[1000px] gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0">
            <p className="m-0 text-[18px] leading-[30px] text-[var(--ink-75)]">
              {BRAND.symbol} is the community token of {BRAND.name}, launching on {LAUNCHPAD.name}. No utility is switched on today: the scanner, the review, the revoke queue and community labels are free and need no token. The token carries no promise of value, returns or a share of anything.
            </p>
            <div className="mt-8 max-w-[640px]">
              <CaRow testid="token-page-ca" />
              {!TOKEN.isLive ? <p className="nl-small mt-3">The contract address is published here and by {BRAND.xHandle} at launch; any other address is not ours.</p> : null}
            </div>
          </div>
          <img src={ASSETS.markLarge} alt={`${BRAND.name} mark`} width={220} height={220} className="hidden w-full lg:block" />
        </div>
      </PageHero>
      <section className="nl-page !pt-14">
        <div className="nl-container">
          <TokenFacts />
          <div className="mt-6">
            <LiveLine />
          </div>
          <section className="mt-16">
            <span className="nl-planned">Planned, not live</span>
            <h2 className="nl-h2 mt-4 !text-[40px]">Planned uses of {BRAND.symbol}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {PLANNED.map((x) => (
                <div key={x.t} className="nl-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                    {x.t} <span className="nl-planned">planned</span>
                  </div>
                  <p className="nl-text">{x.p}</p>
                </div>
              ))}
            </div>
          </section>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <section className="nl-note">
              <b>What never needs the token.</b> Scanning any address, reviewing spenders, revoking (gas only), writing labels and flags. Holding {BRAND.symbol} gives no extra weight to a label or a flag.
            </section>
            <section className="nl-note warn">
              <b>Before you buy.</b> Trust one address: the one on this page, also posted by {BRAND.xHandle}. Prices of new tokens swing hard; only use money you could lose without trouble. Not financial advice.
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
