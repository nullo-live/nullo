import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BRAND } from "@/config/brand";
import { DeployPanel } from "@/components/deploy/DeployPanel";
import ART from "@/lib/contracts/artifacts.json";

export const metadata: Metadata = {
  title: "Deploy contracts",
  description: `Owner tool: deploy the ${BRAND.name} contract from your own wallet.`,
  robots: { index: false, follow: false },
};

// Owner tool, local only: on any public host this route is a 404.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export const dynamic = "force-dynamic";

export default async function DeployPage() {
  const host = (await headers()).get("host") ?? "";
  if (!LOCAL_HOST.test(host)) notFound();
  return (
    <>
      <main id="main" className="nl-page !pt-40">
        <div className="nl-container">
          <p className="nl-kicker m-0">Owner tool · localhost only</p>
          <h1 className="nl-page-title mt-4">Deploy NulloSpenderLabels</h1>
          <p className="mt-6 max-w-[64ch] text-[16px] leading-[1.65]">
            One transaction, signed in your wallet on Robinhood Chain. No constructor arguments, no owner, no fee and no token needed, so it can go live before the token launches. Progress is kept in this browser. Deployment uses about 1,860,000 gas (1,850,541 measured on a local chain with id 4663).
          </p>
          <div className="mt-10">
            <DeployPanel labels={{ creation: ART.contracts.NulloSpenderLabels.creation, sha256: ART.contracts.NulloSpenderLabels.sha256 }} />
          </div>
        </div>
      </main>
    </>
  );
}
