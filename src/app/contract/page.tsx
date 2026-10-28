import Link from "next/link";
import { BRAND, CHAIN, explorerAddress } from "@/config/brand";
import { CONTRACTS, labelsLive } from "@/config/contracts";
import { CATEGORIES, REASONS } from "@/lib/abi";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/contract",
  title: `The labels contract | ${BRAND.name}`,
  description: `What the NulloSpenderLabels contract on ${CHAIN.name} can and cannot do: no owner, no fee, no funds, counts labels and flags, never hides anything.`,
});

export default function ContractPage() {
  return (
    <ProsePage
      title="The labels contract"
      updated="30 October 2026"
      lead={`NulloSpenderLabels is the only contract ${BRAND.name} adds to ${CHAIN.name}. It stores community notes about spender addresses. It has no owner and no admin key, holds no funds, and has no way to touch your tokens or allowances.`}
      sections={[
        {
          h: "What it can do",
          p: [
            "Any wallet can attach one label to a spender: a name of 1 to 32 plain characters, a category, and an optional https link (the link text is in the event, its keccak-256 hash is stored). The same wallet can replace or remove its own label at any time.",
            "Any wallet can flag a spender once, with a reason code, and take its flag back. The contract keeps totals per spender: labels, flags, and counts per category and per reason. It lists every spender ever labelled or flagged, in first-seen order.",
          ],
        },
        {
          h: "What it cannot do",
          p: [
            "It cannot hide, remove or rank anyone else's label or flag. There is no owner, no admin, no pause, no fee and no upgrade path; the code that is deployed is the code that runs, for good.",
            "It has no payable function, no receive and no fallback, so it cannot hold ETH or tokens. It never calls a token. Revoking a permission is a call your wallet makes to the token itself, not to this contract.",
            "It cannot tell whether a label is true. A label is a public note signed by the wallet that wrote it.",
          ],
        },
        {
          h: "Codes",
          p: [`Categories: ${CATEGORIES.slice(1).map((c, i) => `${i + 1} ${c}`).join(", ")}.`, `Flag reasons: ${REASONS.slice(1).map((c, i) => `${i + 1} ${c}`).join(", ")}.`],
        },
        {
          h: "Where it is",
          p: [
            labelsLive()
              ? `Deployed at ${CONTRACTS.labels} on ${CHAIN.name}. Its source can be read on the explorer, and anyone can check that the deployed code matches this site's build with the verify-deployment script in the repository.`
              : `Not deployed yet. Until it is, the labels page runs in practice mode: labels and flags you write are signed with your wallet and kept in your browser only, so you can see how it will work. Nothing is sent.`,
          ],
        },
      ]}
    >
      <div className="mt-12 flex flex-wrap gap-3">
        {labelsLive() ? (
          <a href={explorerAddress(CONTRACTS.labels)} target="_blank" rel="noreferrer" className="nl-btn md">
            Open on the explorer
          </a>
        ) : null}
        <Link href="/labels" className="nl-btn outline md">
          Browse labels
        </Link>
        <a href="/contracts.json" className="nl-btn outline md">
          ABI and address (JSON)
        </a>
      </div>
    </ProsePage>
  );
}
