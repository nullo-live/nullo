import { ASSETS } from "@/config/assets";

/** Guides (the reference's blog slot). Plain explanations written for this site; dates are when they were written. */
export type Guide = {
  slug: string;
  no: number;
  title: string;
  /** Last words of the title, set in olive on the guide page. */
  tail: string;
  summary: string;
  topic: string;
  date: string;
  minutes: number;
  cover: string;
  tldr: string;
  sections: { h: string; p: string[] }[];
};

export const GUIDES: Guide[] = [
  {
    slug: "what-a-token-approval-is",
    no: 4,
    title: "What a token approval is, and why it",
    tail: "outlives the app.",
    summary: "An approval is a standing instruction inside the token contract. Here is what it lets a spender do, where it lives, and why closing the app does not close it.",
    topic: "Approvals",
    date: "October 30, 2026",
    minutes: 6,
    cover: ASSETS.guides.allowance,
    tldr: "When you approve, the token itself records that a spender may move up to a set amount of your balance. That record stays until you change it, no matter whether you ever open the app again. Reading it is free; changing it is one small transaction from your wallet.",
    sections: [
      {
        h: "The record lives in the token, not in the app",
        p: [
          "Exchanges, lending apps and marketplaces cannot pull tokens from your wallet on their own. Before they can, your wallet calls approve on the token contract and names a spender, usually the app's router or vault, and an amount. The token writes that pair into its own storage.",
          "From then on the spender can call transferFrom and move up to that amount of your balance. The app's website, its servers, even whether the company still exists, have nothing to do with it. Only the token's record counts.",
        ],
      },
      {
        h: "Why it stays open",
        p: [
          "Nothing expires an ERC-20 allowance. Some apps ask for exactly the amount of one trade, and the allowance drops back as it is used. Many ask for an unlimited amount so you never have to approve again. That second kind stays fully open for as long as the token exists.",
          "Most of the time that is fine: a well-built router only moves tokens when you send it a trade. The risk is in what you cannot see. If a spender contract has a flaw, or the address was never the app you thought it was, an open allowance is what lets it act.",
        ],
      },
      {
        h: "What you can do about it",
        p: [
          "First, look. Nullo reads the approvals your address gave on Robinhood Chain and shows the current amount, not an old event. Then decide per spender: keep the ones for apps you still use, close the ones you do not recognise or no longer need.",
          "Closing means calling approve again with an amount of zero. It costs a little gas, and your wallet shows you the call before you sign. You can always approve again later if you return to the app.",
        ],
      },
    ],
  },
  {
    slug: "unlimited-allowances",
    no: 3,
    title: "Unlimited allowances: convenient,",
    tail: "and worth a second look.",
    summary: "Why so many apps ask for the largest possible amount, what that number means in practice, and how to decide which ones to keep.",
    topic: "Allowances",
    date: "October 30, 2026",
    minutes: 5,
    cover: ASSETS.guides.unlimited,
    tldr: "An unlimited allowance lets the spender move every unit of that token you hold, today and in the future. It saves you a transaction on every trade. Keep it for apps you trust and use often; for anything else, an exact amount or a revoke is the calmer choice.",
    sections: [
      {
        h: "Where the huge number comes from",
        p: [
          "Allowances are stored as a 256-bit number. Wallets and apps that want an open-ended approval simply write the largest value that fits. Nullo shows any amount at or above half of that range as Unlimited, because no real balance comes anywhere near it.",
          "Permit2 works the same way with a 160-bit number, and adds an expiry date. An expired Permit2 allowance is shown as closed even if the amount is still large.",
        ],
      },
      {
        h: "The trade-off",
        p: [
          "With an exact allowance you approve again before every trade, which costs gas and an extra click. With an unlimited one you approve once. The price of that convenience is that a single problem in the spender would reach your whole balance of that token, including tokens you receive later.",
          "There is no universal right answer. A router you use every day is a different case from a contract you approved once during a mint months ago.",
        ],
      },
      {
        h: "A simple routine",
        p: [
          "Scan your address now and then. Sort the unlimited rows by how recently they changed. Keep the ones you clearly recognise, look at the hints and labels for the rest, and add the ones you do not need to the revoke queue. Each revoke is a separate transaction, so you stay in control of every step.",
        ],
      },
    ],
  },
  {
    slug: "nft-operator-approvals",
    no: 2,
    title: "NFT operator approvals cover",
    tail: "the whole collection.",
    summary: "setApprovalForAll is how marketplaces list your items. It is also the widest permission an NFT contract can give. What it covers and how to close it.",
    topic: "NFTs",
    date: "October 30, 2026",
    minutes: 4,
    cover: ASSETS.guides.operator,
    tldr: "An operator approval lets one address move every item you own in that collection, including items you receive later. A single-item approval covers one token id and clears when the item moves. Close operator approvals you no longer use with setApprovalForAll(operator, false).",
    sections: [
      {
        h: "Two kinds of NFT permission",
        p: [
          "ERC-721 has two approvals. approve(to, tokenId) names one address for one item; it is cleared automatically when that item is transferred. setApprovalForAll(operator, true) names an operator for the whole collection; it stays until you switch it off. ERC-1155 collections only have the second kind.",
          "Marketplaces usually ask for the operator kind, so that one approval lets them settle any sale you make in that collection.",
        ],
      },
      {
        h: "What Nullo shows",
        p: [
          "Operator approvals appear as Collection operator with the amount All items, and the review hint reminds you that it covers future items too. Single-item approvals appear with their token id and are re-read with getApproved, so an item that has moved on shows as closed.",
        ],
      },
      {
        h: "Closing them",
        p: [
          "For an operator the revoke call is setApprovalForAll(operator, false) on the collection contract. For a single item it is approve(0x0000…0000, tokenId). Both are shown in full before your wallet opens, and the row is read again once the transaction lands.",
        ],
      },
    ],
  },
  {
    slug: "read-the-call-before-you-sign",
    no: 1,
    title: "Read the call",
    tail: "before you sign it.",
    summary: "Every revoke in Nullo shows its target, function and call data first. How to read those few lines, and why you should check them in your wallet too.",
    topic: "Signing",
    date: "October 30, 2026",
    minutes: 4,
    cover: ASSETS.guides.calldata,
    tldr: "A transaction is just a target address and some bytes. The first four bytes pick the function; the rest are its arguments. Before signing a revoke, check three things: the target is the token, the function is the zeroing one, and the amount is zero.",
    sections: [
      {
        h: "Anatomy of a revoke",
        p: [
          "Take a token allowance. The target is the token contract. The call data starts with 0x095ea7b3, the selector of approve(address,uint256). Then come two 32-byte words: the spender's address, padded with zeros on the left, and the amount, which for a revoke is all zeros.",
          "Nullo prints the function signature, each argument and the raw bytes side by side, so you can match them against what your wallet shows.",
        ],
      },
      {
        h: "Check it twice",
        p: [
          "Your wallet is the last word, not this site. A good wallet decodes approve calls and shows the spender and the new amount. If what it shows does not match the row you picked, cancel. A revoke never needs to send ETH, so the value should be zero as well.",
        ],
      },
      {
        h: "One at a time, or one batch you can read",
        p: [
          "The revoke queue runs one transaction at a time. After each confirmation the state is read again from the chain, and the next row only opens when you ask for it. Nothing is signed for you.",
          "If your wallet supports atomic batches (EIP-5792), the queue also offers one signature for every row. The batch holds exactly the calls listed in the queue, runs all of them or none, and every row is read again from the chain afterwards. Your wallet should list each call before you confirm.",
        ],
      },
    ],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug) ?? null;
