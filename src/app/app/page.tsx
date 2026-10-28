import { Suspense } from "react";
import { BRAND, CHAIN } from "@/config/brand";
import { Workspace } from "@/components/app/Workspace";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/app",
  title: `Permission scanner | ${BRAND.name}`,
  description: `Scan any address on ${CHAIN.name} for open token approvals, NFT operators and Permit2 allowances, review each spender, and revoke with your own wallet.`,
});

export default function AppPage() {
  return (
    <main id="main" className="nl-app">
      <div className="nl-wash" aria-hidden="true" />
      <div className="nl-grid-lines" aria-hidden="true" />
      <div className="nl-container relative">
        <p className="nl-badge m-0">
          <i /> {CHAIN.name} · read-only until you sign
        </p>
        <h1 className="nl-h1 !text-[clamp(40px,5vw,60px)]">
          Permission <span>scanner.</span>
        </h1>
        <p className="nl-lead !mt-4 max-w-[760px] !text-[20px] !leading-[32px]">Read what an address has approved, see who holds each permission, and close the ones you no longer need.</p>
        <div className="mt-10">
          <Suspense fallback={<p className="nl-small">Loading…</p>}>
            <Workspace />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
