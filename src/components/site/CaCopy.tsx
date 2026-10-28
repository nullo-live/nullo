"use client";

import Link from "next/link";
import { useState } from "react";
import { BRAND, TOKEN, isAddress, shortAddress } from "@/config/brand";
import { CheckIcon, CopyIcon } from "@/components/site/Icons";

/* Copy CA: one component family, one source (BRAND.ca). Before launch it says "At launch" and copies nothing. */

export function useCopy(value: string) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused; the text stays visible.
    }
  };
  return { copied, copy };
}

/** Navbar chip: "$NULLO 0x12…abcd" copies once the CA is real; before that it opens the token page ("at launch"). */
export function CaPill({ className = "" }: { className?: string }) {
  const { copied, copy } = useCopy(BRAND.ca);
  if (!TOKEN.isLive)
    return (
      <Link href="/token" className={`nl-chip ${className}`} data-testid="ca-pill" title="The contract address is published at launch">
        {BRAND.symbol} <span className="font-normal opacity-70">· at launch</span>
      </Link>
    );
  return (
    <button type="button" className={`nl-chip ${className}`} onClick={copy} data-testid="ca-pill" title={`Copy the ${BRAND.symbol} contract address`}>
      {BRAND.symbol} <span className="font-normal opacity-80">{shortAddress(BRAND.ca, 4, 4)}</span>
      {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
    </button>
  );
}

/** "CA 0x… [COPY]" box: hero, footer, token sheet. Before launch the button says "At launch" and copies nothing. */
export function CaRow({ testid = "ca-row", label = "CA" }: { testid?: string; label?: string }) {
  const { copied, copy } = useCopy(BRAND.ca);
  const live = TOKEN.isLive;
  return (
    <span className="nl-ca" data-testid={testid}>
      <span className="nl-ca-tag">{label}</span>
      <code className="nl-ca-val" title={live ? BRAND.ca : undefined}>
        {live ? BRAND.ca : `${BRAND.symbol} address is published at launch`}
      </code>
      <button type="button" className={`nl-ca-btn${copied ? " done" : ""}`} onClick={copy} disabled={!live} data-testid={`${testid}-copy`} title={live ? "Copy the contract address" : "Published at launch"}>
        {live ? (copied ? "Copied" : "Copy") : "At launch"}
      </button>
    </span>
  );
}

/** Any address or hash as a copy chip. Empty value => `empty` text. */
export function AddressChip({ value, empty = "Not deployed yet", head = 6, tail = 4 }: { value: string; empty?: string; head?: number; tail?: number }) {
  const { copied, copy } = useCopy(value);
  const ok = isAddress(value) || /^0x[0-9a-fA-F]{64}$/.test(value);
  return (
    <button type="button" className="nl-code" onClick={copy} disabled={!ok} title={ok ? "Copy" : empty}>
      {ok ? shortAddress(value, head, tail) : empty}
      {ok ? copied ? <CheckIcon size={12} /> : <CopyIcon size={12} /> : null}
    </button>
  );
}
