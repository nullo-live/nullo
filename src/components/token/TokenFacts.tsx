"use client";

import { useChain } from "@/components/providers/ChainProvider";
import { BRAND, LAUNCHPAD, TOKEN, buyUrl, chartUrl } from "@/config/brand";
import { fmtSupply, usd } from "@/lib/format";

/** Token facts read on chain (after launch) plus public market data; before launch every slot says so. */
export function TokenFacts() {
  const { facts } = useChain();
  const live = TOKEN.isLive;
  const t = facts?.token;
  const m = facts?.market;
  const items = [
    { k: "Name / symbol", v: live ? (t?.name && t?.symbol ? `${t.name} / ${t.symbol}` : "—") : "At launch" },
    { k: "Total supply", v: live ? fmtSupply(t?.supply ?? null, t?.decimals ?? null) : "At launch" },
    { k: "Price", v: live ? usd(m?.priceUsd ?? null, 8) : "—" },
    { k: "Liquidity", v: live ? usd(m?.liquidityUsd ?? null, 0) : "—" },
  ];
  const chart = chartUrl(BRAND.ca);
  return (
    <section className="nl-panel" data-testid="token-facts">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[24px] font-bold tracking-tight">On chain</h2>
        <span className="nl-tag">{live ? "Read live" : "Before launch"}</span>
      </div>
      <dl className="m-0 mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.k} className="nl-stat min-w-0">
            <dt className="k">{i.k}</dt>
            <dd className="v m-0 truncate !text-[20px]">{i.v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap gap-3 border-t border-[var(--line-soft)] pt-6">
        <a href={buyUrl()} target="_blank" rel="noreferrer" className="nl-btn sm" data-testid="buy">
          {live ? `Buy on ${LAUNCHPAD.name}` : `${LAUNCHPAD.name} launchpad · at launch`}
        </a>
        {TOKEN.explorerUrl ? (
          <a href={TOKEN.explorerUrl} target="_blank" rel="noreferrer" className="nl-btn outline sm">
            Explorer
          </a>
        ) : null}
        {chart ? (
          <a href={chart} target="_blank" rel="noreferrer" className="nl-btn outline sm">
            Chart on DEXTools
          </a>
        ) : null}
      </div>
    </section>
  );
}
