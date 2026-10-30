import Link from "next/link";
import { BRAND, hasGithub } from "@/config/brand";
import { Brand } from "@/components/site/Brand";
import { CaRow } from "@/components/site/CaCopy";
import { GitHubLogo, XLogo } from "@/components/site/Icons";
import { FOOTER_COLUMNS } from "@/components/site/nav";

export function SiteFooter() {
  return (
    <footer className="nl-footer">
      <div className="nl-container">
        <div className="nl-footer-in">
          <div>
            <Brand />
            <p className="blurb">Read every token permission your wallet has given on {BRAND.chainName}, see who holds it, and close what you no longer need from your own wallet.</p>
          </div>
          {FOOTER_COLUMNS.map((c) => (
            <nav key={c.title} className="nl-footer-links" aria-label={c.title}>
              <h3>{c.title}</h3>
              {c.links.map((n) => (
                <Link key={n.href} href={n.href}>
                  {n.label}
                </Link>
              ))}
            </nav>
          ))}
          <nav className="nl-footer-links" aria-label="Community">
            <h3>Community</h3>
            <a href={BRAND.x} target="_blank" rel="noreferrer" className="!inline-flex items-center gap-2">
              <XLogo size={14} /> {BRAND.xHandle}
            </a>
            {hasGithub ? (
              <a href={BRAND.github} target="_blank" rel="noreferrer" className="!inline-flex items-center gap-2">
                <GitHubLogo size={14} /> GitHub
              </a>
            ) : null}
          </nav>
          <nav className="nl-footer-links" aria-label="Reads from">
            <h3>Reads from</h3>
            <a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noreferrer">
              {BRAND.chainName}
            </a>
            <a href="https://www.geckoterminal.com/robinhood/pools" target="_blank" rel="noreferrer">
              GeckoTerminal
            </a>
            <a href="https://data.chain.link" target="_blank" rel="noreferrer">
              Chainlink ETH / USD
            </a>
            <a href="https://ponsfamily.com/launchpad" target="_blank" rel="noreferrer">
              Pons
            </a>
          </nav>
        </div>
        <div className="nl-footer-end">
          <div className="min-w-0 max-w-[520px] flex-1 basis-[300px]">
            <CaRow testid="footer-ca" />
          </div>
          <p className="nl-footer-legal m-0 flex-1 basis-[320px]">
            {BRAND.name} reads the chain and prepares transactions your own wallet signs. It never holds funds or keys and cannot make a wallet safe. {BRAND.symbol} is a community token with no promised value; its utility is planned. Nothing here is financial advice. © {new Date().getFullYear()} {BRAND.name}.
          </p>
        </div>
      </div>
    </footer>
  );
}
