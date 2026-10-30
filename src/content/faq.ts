import { BRAND, CHAIN, LAUNCHPAD, TOKEN } from "@/config/brand";

/** FAQ shared by the home page and its FAQPage structured data. */
export function faqItems(): { q: string; a: string }[] {
  return [
    {
      q: `What is ${BRAND.name}?`,
      a: `${BRAND.name} is a permission reader for wallets on ${CHAIN.name}. It looks for the token approvals a wallet has signed (ERC-20 allowances, NFT operator and single-item approvals, Permit2 allowances), reads which of them are still open right now, shows who holds each one, and lets you close the ones you no longer want with a transaction your own wallet signs.`,
    },
    {
      q: "Does it make my wallet safe?",
      a: "No tool can promise that, and we do not. Closing an approval only stops that spender from moving tokens through that approval from now on. It does not undo past transfers, protect a leaked seed phrase, or judge whether an app is honest. What it does is make your open permissions visible so you can decide.",
    },
    {
      q: "Do I need to connect a wallet?",
      a: "Not to look. You can paste any address and read its permissions; reading is public. Connecting is only needed to revoke, and the transaction then comes from your wallet, after you have seen the exact call data.",
    },
    {
      q: "How does the scanner find my approvals?",
      a: `Three ways, each labelled in the results. It reads the chain's approval events for your address in block windows (the most recent first), it checks the current allowance of the most traded tokens on ${CHAIN.name} against confirmed spenders (DEX routers, aggregators, Permit2 and each token's own Pons curve), and, when this site has an explorer key configured, it asks the explorer for your full approval history. Whatever the source, the number shown is always a fresh read of the token, not an old event.`,
    },
    {
      q: "Why might an old approval be missing?",
      a: "Public RPC endpoints only answer event searches over limited block ranges, and this chain produces many blocks per second, so the event scan covers the window you choose (progress is kept in your browser, so a long window can be finished over several visits). The quick check still finds open allowances of any age for common tokens and spenders, and you can check any token and spender pair by hand. When the explorer source is on, the full history is read.",
    },
    {
      q: "What does revoking cost, and what exactly is sent?",
      a: "Only the network's gas, paid in ETH by your wallet. For a token allowance the call is approve(spender, 0) on the token; for an NFT operator it is setApprovalForAll(operator, false); for a single NFT it is approve(0x0, tokenId); for Permit2 it is approve(token, spender, 0, 0) on Permit2. Each call is shown in full before your wallet opens.",
    },
    {
      q: "What are hints and community labels?",
      a: "Hints are facts read from the chain, such as an unlimited amount, a spender with no contract code, or no change for months. Labels and flags are notes other wallets wrote about a spender in the NulloSpenderLabels contract. Both help you decide; neither is a verdict, and anyone can write a label, so read who wrote it.",
    },
    {
      q: "Does Nullo store my address or history?",
      a: "No account, no database of wallets. The scan runs in your browser through this site's read relay, which counts requests per network to protect its quota. Your revoke queue and settings stay in your browser's local storage.",
    },
    {
      q: `What is ${BRAND.symbol} for?`,
      a: `${BRAND.symbol} is the project's community token. Analytics credits, premium alerts, monitoring and developer API access are planned uses; none of them is live, and the token carries no promise of value. Every feature on this site works without holding it.`,
    },
    {
      q: `How do I get ${BRAND.symbol}?`,
      a: TOKEN.isLive
        ? `${BRAND.symbol} trades on ${LAUNCHPAD.name}, the launchpad on ${CHAIN.name}. Check the contract address on the token page before you buy.`
        : `${BRAND.symbol} has not launched yet. Its contract address will be published on the token page at launch; until then, any address claiming to be ${BRAND.symbol} is not ours.`,
    },
    {
      q: `Which network does ${BRAND.name} use?`,
      a: `${CHAIN.name} (chain id ${CHAIN.id}), where gas is paid in ETH. Connecting a wallet adds the network for you if it is missing.`,
    },
  ];
}
