import { parseAbi } from "viem";

/*
 * ABIs the site needs. LABELS_ABI mirrors contracts/src/NulloSpenderLabels.sol (src/lib/abi.test.ts checks it against
 * the compiled artifact so the two cannot drift apart). The token ABIs are the standard read and revoke functions.
 */
export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

/** ERC-721 / ERC-1155 permission functions (setApprovalForAll and isApprovedForAll are shared by both). */
export const NFT_ABI = parseAbi([
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function approve(address to, uint256 tokenId)",
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
]);

/** Permit2's own allowance table (owner => token => spender). */
export const PERMIT2_ABI = parseAbi([
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
  "event Approval(address indexed owner, address indexed token, address indexed spender, uint160 amount, uint48 expiration)",
  "event Permit(address indexed owner, address indexed token, address indexed spender, uint160 amount, uint48 expiration, uint48 nonce)",
  "event Lockdown(address indexed owner, address token, address spender)",
]);

export const MULTICALL3_ABI = parseAbi([
  "struct Call3 { address target; bool allowFailure; bytes callData; }",
  "struct Result { bool success; bytes returnData; }",
  "function aggregate3(Call3[] calls) payable returns (Result[] returnData)",
]);

export const OWNER_ABI = parseAbi(["function owner() view returns (address)", "function getOwner() view returns (address)"]);

export const FEED_ABI = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

export const LABELS_ABI = parseAbi([
  "struct Label { address author; uint8 category; uint64 updatedAt; uint64 chainBlock; bytes32 urlHash; string name; }",
  "function MAX_NAME() view returns (uint256)",
  "function MAX_URL() view returns (uint256)",
  "function MAX_CATEGORY() view returns (uint8)",
  "function MAX_REASON() view returns (uint8)",
  "function MAX_PAGE() view returns (uint256)",
  "function totalLabels() view returns (uint256)",
  "function totalFlags() view returns (uint256)",
  "function setLabel(address spender, string name, uint8 category, string url)",
  "function removeLabel(address spender)",
  "function flag(address spender, uint8 reason)",
  "function unflag(address spender)",
  "function getLabel(address spender, address author) view returns (Label)",
  "function labelsOf(address spender, uint256 offset, uint256 limit) view returns (Label[] out)",
  "function countsOf(address spender) view returns (uint32 labels, uint32 flags, uint32[9] byCategory, uint32[7] byReason)",
  "function flagOf(address spender, address flagger) view returns (uint8)",
  "function labelCountOf(address author) view returns (uint256)",
  "function spendersLabelledBy(address author, uint256 offset, uint256 limit) view returns (address[] out)",
  "function spenderCount() view returns (uint256)",
  "function spendersFrom(uint256 offset, uint256 limit) view returns (address[] out)",
  "function chainBlock() view returns (uint64)",
  "event Labeled(address indexed spender, address indexed author, string name, uint8 category, string url, bytes32 urlHash, bool updated, uint64 chainBlock)",
  "event LabelRemoved(address indexed spender, address indexed author, uint64 chainBlock)",
  "event Flagged(address indexed spender, address indexed flagger, uint8 reason, uint64 chainBlock)",
  "event Unflagged(address indexed spender, address indexed flagger, uint64 chainBlock)",
  "error ZeroSpender()",
  "error BadName()",
  "error BadUrl()",
  "error BadCategory(uint8 category)",
  "error BadReason(uint8 reason)",
  "error NoLabel(address spender, address author)",
  "error AlreadyFlagged(address spender)",
  "error NotFlagged(address spender)",
  "error SelfFlag()",
  "error PageTooLarge()",
]);

export const ALL_ERRORS = LABELS_ABI.filter((x) => x.type === "error");

/** Plain words for each custom error, shown instead of a selector. */
export const ERROR_WORDS: Record<string, string> = {
  ZeroSpender: "Enter the spender's address.",
  BadName: "A label name is 1 to 32 plain characters (letters, digits, punctuation), with no space at either end.",
  BadUrl: "A link must start with https://, have no spaces and be at most 128 characters. Leave it empty if you have none.",
  BadCategory: "Pick one of the listed categories.",
  BadReason: "Pick one of the listed reasons.",
  NoLabel: "This wallet has no label on that spender to remove.",
  AlreadyFlagged: "This wallet already flagged that spender. Take the flag back first to change the reason.",
  NotFlagged: "This wallet has not flagged that spender.",
  SelfFlag: "A wallet cannot flag its own address.",
  PageTooLarge: "Asked for too many entries at once.",
};

/** Category codes of NulloSpenderLabels (index = code). */
export const CATEGORIES = ["", "Exchange router", "Lending", "NFT marketplace", "Bridge", "Launchpad", "Token permit service", "App or game", "Other"] as const;
/** Flag reason codes of NulloSpenderLabels (index = code). */
export const REASONS = ["", "Unexpected transfers reported", "Imitates a known app", "Source not published", "Linked from a phishing site", "Abandoned or replaced", "Other"] as const;
