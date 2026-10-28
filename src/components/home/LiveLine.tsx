"use client";

import { useChain } from "@/components/providers/ChainProvider";
import { CHAIN, explorerBlock } from "@/config/brand";
import { labelsLive } from "@/config/contracts";

const n = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }));

/** Live Robinhood Chain facts from the site's snapshot: block, gas, ETH / USD, and the label totals once deployed. */
export function LiveLine({ dark = false }: { dark?: boolean }) {
  const { facts, failed } = useChain();
  const cells: [string, React.ReactNode][] = [
    [
      "Block",
      facts?.block ? (
        <a href={explorerBlock(facts.block)} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline" data-testid="live-block">
          {n(facts.block)}
        </a>
      ) : (
        "—"
      ),
    ],
    ["Block time", facts?.blockPace != null ? `${n(facts.blockPace, 2)} s` : "—"],
    ["Gas", facts?.gasGwei != null ? `${n(facts.gasGwei, 3)} gwei` : "—"],
    ["ETH / USD", facts?.ethUsd != null ? `$${n(facts.ethUsd, 2)}` : "—"],
    ["Community labels", labelsLive() ? n(facts?.labels?.labels) : "Contract not deployed yet"],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="live-line">
      {cells.map(([k, v]) => (
        <div key={k} className={dark ? "nl-dark-card !p-4" : "nl-stat"}>
          <p className={dark ? "k" : "k"}>{k}</p>
          <p className={`v truncate !text-[18px] ${dark ? "m-0 mt-1 font-bold" : ""}`}>{v}</p>
        </div>
      ))}
      <p className={`col-span-full m-0 text-[12px] ${dark ? "text-white/60" : "text-[var(--ink-55)]"}`}>
        {failed ? `${CHAIN.name} could not be reached just now; values show "—".` : `Read live from ${CHAIN.name} (chain id ${CHAIN.id}); ETH / USD from the Chainlink feed on the same chain.`}
      </p>
    </div>
  );
}
