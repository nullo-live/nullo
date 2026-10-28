import Link from "next/link";
import { BRAND, CHAIN } from "@/config/brand";
import { labelsLive } from "@/config/contracts";
import { faqItems } from "@/content/faq";
import { GUIDES } from "@/content/guides";
import { JsonLd } from "@/components/JsonLd";
import { HeroCard } from "@/components/home/HeroCard";
import { LabelsBand } from "@/components/home/LabelsBand";
import { LiveLine } from "@/components/home/LiveLine";
import { RevokeDemo } from "@/components/home/RevokeDemo";
import { TreeCard } from "@/components/home/TreeCard";
import { CaRow } from "@/components/site/CaCopy";
import { ArrowRight, BanIcon, ChevronRight, KeyIcon, ScanIcon, XLogo } from "@/components/site/Icons";
import { appLd, faqLd } from "@/lib/seo";

const SOURCES = [
  { name: "Robinhood Chain", note: "events + state", href: "https://robinhoodchain.blockscout.com" },
  { name: "Multicall3", note: "batched reads", href: `${CHAIN.explorer}/address/0xcA11bde05977b3631167028862bE2a173976CA11` },
  { name: "Permit2", note: "allowances", href: `${CHAIN.explorer}/address/0x000000000022D473030F116dDEE9F6B43aC78BA3` },
  { name: "Chainlink", note: "ETH / USD", href: "https://data.chain.link" },
  { name: "GeckoTerminal", note: "token list", href: "https://www.geckoterminal.com/robinhood/pools" },
  { name: "Blockscout", note: "optional history", href: "https://robinhoodchain.blockscout.com" },
  { name: "Pons", note: "launchpad", href: "https://ponsfamily.com/launchpad" },
  { name: "DEXTools", note: "charts", href: "https://www.dextools.io" },
];

export default function Home() {
  const faq = faqItems();
  const [featured, ...more] = GUIDES;
  return (
    <main id="main">
      <JsonLd data={[appLd, faqLd(faq)]} />

      {/* Hero */}
      <section className="nl-hero" data-testid="hero">
        <div className="nl-wash" aria-hidden="true" />
        <div className="nl-grid-lines" aria-hidden="true" />
        <div className="nl-orb a" aria-hidden="true" />
        <div className="nl-orb b" aria-hidden="true" />
        <div className="nl-container relative">
          <div className="nl-split">
            <div className="nl-reveal">
              <p className="nl-badge m-0">
                <i /> Live on {CHAIN.name}
              </p>
              <h1 className="nl-h1">
                Your Wallet.
                <br />
                <span>Your Permissions.</span>
              </h1>
              <p className="nl-lead">{BRAND.tagline}</p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/app" className="nl-btn" data-testid="hero-open">
                  Open the app <ChevronRight size={18} className="go" />
                </Link>
                <Link href="#how-it-works" className="nl-btn outline">
                  How it works
                </Link>
              </div>
              <p className="nl-small m-0 mt-5 max-w-[572px]">
                Reading permissions is free and needs no wallet. Revoking is a transaction your own wallet signs, and no tool can make a wallet safe:{" "}
                <Link href="/limits" className="nl-link">
                  read the limits
                </Link>
                .
              </p>
            </div>
            <div className="nl-reveal lg:pl-10">
              <HeroCard />
            </div>
          </div>
        </div>
      </section>

      {/* Reads from */}
      <section className="nl-section !pt-[128px] !pb-[96px]" aria-labelledby="sources-title">
        <div className="nl-wash-soft" aria-hidden="true" />
        <div className="nl-container relative">
          <h2 id="sources-title" className="nl-h2 nl-reveal">
            Reads from
          </h2>
          <div className="nl-logo-row nl-reveal">
            {SOURCES.map((s) => (
              <a key={s.name} href={s.href} target="_blank" rel="noreferrer" className="nl-logo">
                {s.name} <small>{s.note}</small>
              </a>
            ))}
          </div>
          <div className="nl-reveal mt-16">
            <LiveLine />
          </div>
        </div>
      </section>

      {/* See every approval */}
      <section id="how-it-works" className="nl-section" aria-labelledby="see-title">
        <div className="nl-wash-soft" aria-hidden="true" />
        <div className="nl-container relative">
          <div className="nl-split">
            <div className="nl-reveal">
              <h2 id="see-title" className="nl-h2">
                See every approval.
                <br />
                <span>Know every spender.</span>
              </h2>
              <p className="nl-lead strong">
                Each time you trade, list an NFT or use a vault, your wallet may leave a permission behind: the token records that some address can move your balance. Those records do not expire when you close the app. {BRAND.name} finds the ones it can, reads whether each is still open right now, and puts the spender, the amount and the{" "}
                <Link href="/guides/what-a-token-approval-is" className="underline decoration-[var(--line)] underline-offset-4">
                  age of the approval
                </Link>{" "}
                side by side.
              </p>
            </div>
            <div className="nl-reveal">
              <TreeCard />
            </div>
          </div>

          <div className="nl-cards3 mt-16">
            <article className="nl-card nl-reveal">
              <p className="nl-kicker">What the scanner reads</p>
              <h3 className="nl-h3">Four kinds of permission</h3>
              <p className="nl-text">
                ERC-20 allowances, NFT collection operators, single-NFT approvals and Permit2 allowances. Events show where to look; the amount shown is always a fresh read from the token or from Permit2, so a permission you already closed shows as closed. Paste any address to read it, no wallet needed.
              </p>
            </article>
            <article className="nl-card nl-reveal">
              <p className="nl-kicker">How the review works</p>
              <h3 className="nl-h3">Hints, not verdicts</h3>
              <p className="nl-text">Every open permission gets plain facts: unlimited amount, a spender with no contract code, months without a change, community flags. You decide what stays.</p>
              <ul className="nl-ticks">
                <li>Spender code, labels and flags read from chain</li>
                <li>Explorer source check when the site has a key</li>
              </ul>
              <Link href="/contract" className="nl-arrow-link mt-5">
                The labels contract, in plain words <ChevronRight size={16} />
              </Link>
            </article>
            <article className="nl-card nl-reveal">
              <p className="nl-kicker">Where it stands</p>
              <h3 className="nl-h3">Live on {CHAIN.name}</h3>
              <p className="nl-text">
                The scanner, the review and the revoke queue work today, for any address on {CHAIN.name}. Community labels {labelsLive() ? "are live on chain." : "run in practice mode in your browser until the contract is deployed."}{" "}
                <Link href="/limits" className="nl-link">
                  Read the limits
                </Link>{" "}
                before you rely on a result.
              </p>
              <ul className="nl-ticks">
                <li>No account, no sign-up</li>
                <li>Network gas only, no fee to us</li>
              </ul>
            </article>
          </div>
          <div className="nl-reveal mt-10 flex flex-wrap gap-3">
            <Link href="/app" className="nl-btn">
              Scan a wallet <ChevronRight size={18} className="go" />
            </Link>
            <Link href="/limits" className="nl-btn outline">
              Read the limits
            </Link>
          </div>
        </div>
      </section>

      {/* Revoke */}
      <section id="revoke" className="nl-section" aria-labelledby="revoke-title">
        <div className="nl-wash-soft" aria-hidden="true" />
        <div className="nl-container relative">
          <div className="nl-reveal max-w-[768px]">
            <h2 id="revoke-title" className="nl-h2">
              Revoke without the guesswork.
            </h2>
            <p className="nl-lead strong">
              {BRAND.name} prepares the{" "}
              <Link href="/glossary" className="underline decoration-[var(--line)] underline-offset-4">
                zeroing call
              </Link>{" "}
              for each permission you pick, shows it byte by byte, and hands it to your wallet. Nothing is sent for you, and nothing is batched behind your back.
            </p>
          </div>
          <div className="nl-cards3 mt-14">
            {[
              { i: <ScanIcon size={18} />, n: "Step 1", t: "Scan an address", d: "Connect a wallet or paste any address. Choose how far back the event scan goes; the quick check of popular tokens runs at the same time." },
              { i: <KeyIcon size={18} />, n: "Step 2", t: "Review each spender", d: "Open permissions are listed with the token, the amount, the spender and its hints. Unknown spender? Check its labels, its code and its explorer page first." },
              { i: <BanIcon size={18} />, n: "Step 3", t: "Close what you do not need", d: "Add rows to the revoke queue, read the call data, sign one transaction at a time. Each row is read from the chain again after it lands." },
            ].map((s) => (
              <article key={s.n} className="nl-card nl-reveal">
                <div className="flex items-start justify-between">
                  <span className="nl-step-icon">{s.i}</span>
                  <span className="nl-kicker">{s.n}</span>
                </div>
                <h3 className="nl-h3 !mt-5 !text-[20px]">{s.t}</h3>
                <p className="nl-text">{s.d}</p>
              </article>
            ))}
          </div>
          <div className="nl-reveal">
            <RevokeDemo />
          </div>
          <div className="nl-reveal mt-10 flex flex-wrap gap-3">
            <Link href="/app?tab=revoke" className="nl-btn">
              Open the revoke queue <ChevronRight size={18} className="go" />
            </Link>
            <Link href="/guides/read-the-call-before-you-sign" className="nl-btn outline">
              Reading call data
            </Link>
          </div>
        </div>
      </section>

      {/* Labels (dark band) */}
      <section id="labels" className="nl-dark" aria-labelledby="labels-title">
        <div className="glow" aria-hidden="true" />
        <div className="lines" aria-hidden="true" />
        <div className="nl-container relative">
          <div className="nl-split">
            <div className="nl-reveal">
              <h2 id="labels-title" className="nl-h2 on-dark">
                Community labels,
                <br />
                kept on chain.
              </h2>
              <p className="nl-lead !text-white/70">Any wallet can name a spender, file it under a category and link its docs. Any wallet can flag one with a reason. Every label shows who wrote it.</p>
              <p className="m-0 mt-5 max-w-[560px] text-[15px] leading-[24px] text-white/55">
                The NulloSpenderLabels contract only counts and lists. It has no owner, cannot hide an entry and cannot touch an allowance. A label is somebody&apos;s note, not a check of the spender.
              </p>
              <Link href="/labels" className="nl-btn ghost-dark mt-10">
                Browse labels <ChevronRight size={18} className="go" />
              </Link>
            </div>
            <div className="nl-reveal">
              <LabelsBand />
            </div>
          </div>
        </div>
      </section>

      {/* Guides */}
      <section className="bg-white">
        <div className="nl-notes" aria-labelledby="guides-title">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="nl-reveal">
              <span className="nl-badge">Guides</span>
              <h2 id="guides-title" className="nl-h2 mt-6">
                Plain notes on
                <br />
                <span>permissions.</span>
              </h2>
            </div>
            <Link href="/guides" className="nl-btn outline sm nl-reveal">
              View all guides <ArrowRight size={16} className="go" />
            </Link>
          </div>
          <Link href={`/guides/${featured.slug}`} className="nl-feature nl-reveal mt-14" data-testid="guide-featured">
            <div className="p-8 sm:p-12">
              <p className="nl-kicker">
                Guide · No. {featured.no} <span className="text-[var(--ink-55)]">• Featured</span>
              </p>
              <h3 className="m-0 mt-4 text-[30px] leading-[1.1] font-bold tracking-tight sm:text-[36px]">
                {featured.title} {featured.tail}
              </h3>
              <p className="m-0 mt-5 text-[18px] leading-[29px] text-[var(--ink-70)]">{featured.summary}</p>
              <p className="nl-meta mt-6">
                <b>The {BRAND.name} Team</b> • <span>{featured.date}</span> • <span>~{featured.minutes} min read</span>
              </p>
              <span className="nl-arrow-link mt-6">
                Read the guide <ArrowRight size={14} />
              </span>
            </div>
            <div className="nl-feature-art">
              <div className="relative">
                <div className="tile">
                  <img src="/brand/mark.webp" alt="" width={56} height={56} />
                </div>
                <p className="m-0 mt-4 text-[11px] font-semibold tracking-[0.1em] text-[#becd67] uppercase">Guide {featured.no}</p>
                <p className="m-0 mt-1 text-[20px] font-semibold">{featured.topic}</p>
              </div>
            </div>
          </Link>
          <h3 className="nl-kicker nl-reveal mt-16 !text-[14px] tracking-[0.1em] uppercase">More guides</h3>
          <div className="nl-cards3 mt-6">
            {more.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className="nl-card nl-reveal !rounded-2xl !p-8">
                <p className="nl-kicker !text-[11px] tracking-[0.08em] uppercase">Guide · No. {g.no}</p>
                <h4 className="m-0 mt-3 text-[18px] leading-[25px] font-bold tracking-tight">
                  {g.title} {g.tail}
                </h4>
                <p className="m-0 mt-3 line-clamp-4 text-[14px] leading-[22.75px] text-[var(--ink-70)]">{g.summary}</p>
                <p className="nl-meta mt-6 border-t border-[var(--line-soft)] pt-4 !text-[12px]">
                  <span>{g.date}</span> • <span>~{g.minutes} min read</span>
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="nl-section" aria-labelledby="faq-title">
        <div className="nl-container relative max-w-[1184px]">
          <div className="nl-reveal text-center">
            <h2 id="faq-title" className="nl-h2">
              Frequently Asked Questions
            </h2>
            <p className="nl-lead olive">Straight answers about what {BRAND.name} reads, and what it does not.</p>
          </div>
          <div className="nl-faq">
            {faq.map((f) => (
              <div key={f.q} className="nl-reveal">
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
          <div className="nl-reveal mt-16 text-center">
            <p className="m-0 text-[17px] font-medium text-[var(--olive)]">Still have questions?</p>
            <a href={BRAND.x} target="_blank" rel="noreferrer" className="nl-btn outline mt-4 !bg-transparent">
              Ask us on X
            </a>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="nl-section" aria-labelledby="live-title">
        <div className="nl-wash-soft" aria-hidden="true" />
        <div className="nl-container relative">
          <div className="nl-reveal mx-auto max-w-[896px] text-center">
            <h2 id="live-title" className="nl-h2">
              {BRAND.name} is live
            </h2>
            <p className="nl-lead olive mx-auto max-w-[768px]">The scanner and the revoke queue are open to every address on {CHAIN.name}, and we reply to questions on X.</p>
          </div>
          <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:px-4">
            <div className="nl-card nl-reveal !p-10 text-center">
              <span className="nl-badge">Live on {CHAIN.name}</span>
              <h3 className="m-0 mt-6 text-[40px] leading-[1.25] font-bold tracking-tight sm:text-[48px]">Open to everyone</h3>
              <p className="mx-auto mt-4 max-w-[448px] text-[16px] leading-[26px] text-[var(--ink-70)]">Paste an address or connect a wallet to read its permissions. Connecting is needed only to revoke. Not a fit if you need to undo a transfer that already happened: nothing on chain can.</p>
              <Link href="/app" className="nl-btn md mt-6">
                Open the app <ChevronRight size={16} className="go" />
              </Link>
              <p className="nl-small m-0 mt-5">
                Your wallet signs every change.{" "}
                <Link href="/limits" className="nl-link">
                  Read the limits
                </Link>{" "}
                first.
              </p>
            </div>
            <div className="nl-card nl-reveal flex flex-col items-center justify-center !p-10 text-center">
              <h3 className="m-0 text-[40px] leading-[1.25] font-bold tracking-tight sm:text-[48px]">Questions?</h3>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <a href={BRAND.x} target="_blank" rel="noreferrer" className="nl-btn outline md">
                  <XLogo size={14} /> Follow on X <ChevronRight size={16} className="go" />
                </a>
                <Link href="/token" className="nl-btn outline md">
                  {BRAND.symbol} token <ChevronRight size={16} className="go" />
                </Link>
              </div>
              <div className="mt-6 w-full max-w-[460px]">
                <CaRow testid="home-ca" />
              </div>
              <p className="nl-small m-0 mt-4">Updates, guides and the only contract address we will ever post.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
