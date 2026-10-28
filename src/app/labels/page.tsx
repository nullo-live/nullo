import { Suspense } from "react";
import { BRAND } from "@/config/brand";
import { labelsLive } from "@/config/contracts";
import { LabelsBoard } from "@/components/labels/LabelsBoard";
import { PageHero } from "@/components/site/PageHero";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/labels",
  title: `Community labels | ${BRAND.name}`,
  description: `Look up what other wallets wrote about a spender address on ${BRAND.chainName}: names, categories, links and flags, each with its author. Add your own label or flag.`,
});

export default function LabelsPage() {
  return (
    <main id="main">
      <PageHero
        title="Spender"
        tail="labels."
        lead={
          labelsLive()
            ? "Names, categories, links and flags that wallets wrote about spender addresses, read live from the NulloSpenderLabels contract. Every entry shows its author; none is a verdict."
            : "Names, categories, links and flags that wallets write about spender addresses. The contract is not deployed yet, so this page runs in practice mode: what you write is signed with your wallet and kept in this browser only."
        }
      />
      <section className="nl-page !pt-12">
        <div className="nl-container">
          <Suspense fallback={<p className="nl-small">Loading…</p>}>
            <LabelsBoard />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
