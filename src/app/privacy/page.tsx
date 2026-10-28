import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/privacy",
  title: `Privacy | ${BRAND.name}`,
  description: `What ${BRAND.name} keeps: no accounts, no wallet database; settings in your browser, request counts per network on the server.`,
});

export default function PrivacyPage() {
  return (
    <ProsePage
      title="Privacy"
      updated="30 October 2026"
      lead={`${BRAND.name} has no accounts and keeps no database of wallets. This page lists what is stored and where.`}
      sections={[
        {
          h: "In your browser",
          p: [
            "Your revoke queue, the last address you scanned, your scan settings, the wallet you chose to connect, and (before the labels contract is deployed) practice labels. All of it sits in your browser's local storage and leaves with it when you clear site data.",
          ],
        },
        {
          h: "On our server",
          p: [
            "Chain reads pass through this site's relay. It does not log addresses. To protect the shared quota it keeps short-lived counters per network (an IP range, not a person), which expire within minutes. When the optional explorer source is used, the address you scan is sent to that explorer to fetch its public history.",
          ],
        },
        {
          h: "On chain",
          p: [
            "Everything on a blockchain is public, including every approval your wallet ever made. A revoke you sign and any label or flag you write are public transactions linked to your address, permanently. Write labels accordingly.",
          ],
        },
        {
          h: "No tracking",
          p: ["This site sets no advertising or analytics cookies and loads no third-party trackers."],
        },
      ]}
    />
  );
}
