import { BRAND, CHAIN } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/limits",
  title: `Limits | ${BRAND.name}`,
  description: `What ${BRAND.name} can and cannot see or do: event windows, the quick check, hints that are not verdicts, revokes that cannot undo the past.`,
});

export default function LimitsPage() {
  return (
    <ProsePage
      title="Limits"
      updated="30 October 2026"
      lead={`${BRAND.name} reads public data on ${CHAIN.name} and prepares transactions your wallet signs. It can miss things, and it cannot make any wallet safe. This page says where the edges are, so you can judge a result for yourself. The list is not exhaustive.`}
      sections={[
        {
          h: "It may not find every approval",
          p: [
            `${CHAIN.name} produces many blocks per second, and public RPC endpoints only search events over a limited block range per request. The event scan therefore reads the window you choose in steps of up to 30,000 blocks, newest first, and shows which blocks it read and which it did not. Progress is kept in your browser, so a long window (up to the whole chain) can be finished over several visits. Approvals in blocks not read yet are only found by the known-spender check (the most traded tokens against confirmed routers, aggregators and each token's Pons curve), by a pair you check by hand, or by the explorer source when this site has its key configured.`,
            "An empty result means nothing was found in what was read. It does not prove the wallet has no open permissions.",
          ],
        },
        {
          h: "Hints and labels are not verdicts",
          p: [
            "Hints are facts read from the chain: an unlimited amount, a spender with no contract code, a long time without a change. A quiet row is not a safe row, and a row with hints is not a harmful one.",
            "Community labels and flags are written by any wallet. Someone can label a harmful contract with a friendly name, or flag an honest one. Each label shows its author; read it as one opinion among others.",
          ],
        },
        {
          h: "Revoking stops the future, not the past",
          p: [
            "A revoke sets one permission to zero from the block it lands in. Tokens already moved stay moved. If a seed phrase or private key has leaked, revoking approvals does not help: move what is left to a new wallet you control.",
            "Some tokens behave unusually: they may refuse approve(spender, 0), charge fees, or be paused. If a revoke fails, the token itself refused it; the reason from the chain is shown as it came.",
          ],
        },
        {
          h: "Your wallet has the last word",
          p: [
            "Every change is a transaction your wallet shows you before you sign. Check the target, the function and the amount there too. A revoke never needs to send ETH. If your wallet shows something different from the row you picked, cancel.",
            `${BRAND.name} never asks for a seed phrase, never holds keys or funds, and never sends a transaction on its own. Anyone who asks for those in our name is not us.`,
          ],
        },
        {
          h: "Reads can fail or lag",
          p: [
            "Reads go through this site's relay to public endpoints that sometimes refuse or time out. A token that does not answer a read is shown as unreadable, never as closed. Numbers we could not read show as —. The relay counts requests per network, so a very large scan may be asked to slow down.",
          ],
        },
      ]}
    />
  );
}
