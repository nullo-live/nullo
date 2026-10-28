"use client";

import { useChain } from "@/components/providers/ChainProvider";
import { CATEGORIES } from "@/lib/abi";
import { labelsLive } from "@/config/contracts";

/** Dark band card stack (the reference's score card slot): live label totals once the contract is deployed. */
export function LabelsBand() {
  const { facts } = useChain();
  const live = labelsLive();
  const v = (x: number | null | undefined) => (live && x != null ? x.toLocaleString("en-US") : "—");
  return (
    <div className="relative grid gap-4" data-testid="labels-band">
      <div className="nl-dark-card big flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="k">Community labels</p>
          <p className="m-0 mt-2 text-[56px] leading-none font-bold tracking-tight sm:text-[72px]" data-testid="labels-total">
            {v(facts?.labels?.labels)}
          </p>
          <p className="muted m-0 mt-3 text-[14px]">{live ? `${v(facts?.labels?.flags)} flags · ${v(facts?.labels?.spenders)} spenders` : "Counts appear once the contract is deployed"}</p>
        </div>
        <svg viewBox="0 0 120 120" className="h-[110px] w-[110px] shrink-0" aria-hidden="true">
          <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
          <circle className="nl-ring" cx="60" cy="60" r="48" fill="none" stroke="#becd67" strokeWidth="8" strokeLinecap="round" strokeDasharray="300" strokeDashoffset="90" transform="rotate(-90 60 60)" />
          <g className="nl-scan-line">
            <path d="M60 60 L60 18" stroke="rgba(190,205,103,0.6)" strokeWidth="2" />
          </g>
          <text x="60" y="66" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="18" fontWeight="700">
            Labels
          </text>
        </svg>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="nl-dark-card">
          <p className="k">Categories</p>
          <ul className="m-0 mt-4 grid list-none gap-2 p-0">
            {CATEGORIES.slice(1).map((c) => (
              <li key={c} className="flex items-center gap-2 text-[13px] font-medium text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-[#becd67]" />
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="nl-dark-card">
          <p className="k">Output</p>
          <p className="m-0 mt-3 text-[17px] font-semibold">Counts, never verdicts</p>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="k !text-[11px] !normal-case !tracking-normal">Per spender</p>
            <p className="m-0 mt-1 text-[15px] font-bold">Labels, flags, reasons</p>
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="k !text-[11px] !normal-case !tracking-normal">Hidden by the contract</p>
            <p className="m-0 mt-1 text-[15px] font-bold text-[#becd67]">Nothing, ever</p>
          </div>
        </div>
      </div>
    </div>
  );
}
