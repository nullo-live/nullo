// Single place to change project identity. Everything on the site reads from here.
// To publish the real contract address, replace the value of CA below. The navbar copy pill, the footer,
// the token page and every explorer link derive from it. Anything that is not a 0x + 40 hex address is
// treated as "not launched yet".

/** Contract address of $NULLO. "TBA" until the owner publishes it (typed string so a real 0x value drops in). */
const CA: string = "TBA";

/**
 * True once the domain points at this deployment. While false, the production *.vercel.app host is served
 * as is (kept out of search with noindex) instead of redirecting to a domain that does not serve the site.
 * 30 Oct 2026: nullo.live IS registered (Identity Digital RDAP 200, NS mcgrory/sara.ns.cloudflare.com) but has no
 * A/CNAME record yet (DoH: SOA only). Flip this once it serves this deployment.
 */
export const DOMAIN_LIVE = false;

export const isAddress = (v: string): v is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(v);

const NAME = "Nullo";
const SLUG = "nullo";
/** Shown upper case everywhere; the owner wrote it as $nullo. */
const TICKER = "NULLO";
const DOMAIN = "nullo.live";
/** X account from the owner's order (x.com/nullo). It looks generic; confirm it belongs to the project. */
const X_HANDLE = "nullo";

export const BRAND = {
  name: NAME,
  /** Lowercase id for package names and the like. Never used for stored keys (those are neutral). */
  slug: SLUG,
  ticker: TICKER,
  symbol: `$${TICKER}`,
  domain: DOMAIN,
  url: `https://${DOMAIN}`,
  slogan: "Your Wallet. Your Permissions.",
  tagline: "Building a clearer way to review onchain access.",
  category: "wallet permission review",
  chainName: "Robinhood Chain",
  description: `${NAME} shows which token permissions your wallet has given on Robinhood Chain: every ERC-20 allowance, NFT operator approval and Permit2 allowance it can find, who received it, hints to review it, and a revoke queue your own wallet signs one transaction at a time.`,
  x: `https://x.com/${X_HANDLE}`,
  xHandle: `@${X_HANDLE}`,
  // Public source repository. Set to "" to hide every GitHub link on the site.
  // No public repository yet: every GitHub link to it stays hidden until this is set.
  github: "",
  ca: CA,
} as const;

/** True once BRAND.github points at an actual repository, not the bare host. */
export const hasGithub = /^https:\/\/github\.com\/[^/]+/.test(BRAND.github);

// Public endpoints are the default. An operator can point the site at a private RPC with ROBINHOOD_RPC_URL
// (server) / NEXT_PUBLIC_ROBINHOOD_RPC_URL (browser). Both are optional.
const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";

export const CHAIN = {
  id: 4663,
  hex: "0x1237",
  name: "Robinhood Chain",
  nativeSymbol: "ETH",
  decimals: 18,
  publicRpc: PUBLIC_RPC,
  rpc: process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || PUBLIC_RPC,
  /** Second public endpoint, used for reads only when the first one fails. */
  fallbackRpc: "https://robinhood-rpc.publicnode.com",
  /** Third read endpoint for server code (some networks intercept the official host). */
  spareRpc: "https://robinhood.drpc.org",
  explorer: "https://robinhoodchain.blockscout.com",
} as const;

/** RPC for server code: the private endpoint when set, else the public one. */
export function serverRpc() {
  return process.env.ROBINHOOD_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || PUBLIC_RPC;
}

export const TOKEN = {
  get isLive() {
    return isAddress(BRAND.ca);
  },
  get explorerUrl() {
    return isAddress(BRAND.ca) ? explorerToken(BRAND.ca) : null;
  },
};

export function explorerAddress(address: string) {
  return `${CHAIN.explorer}/address/${address}`;
}
export function explorerToken(address: string) {
  return `${CHAIN.explorer}/token/${address}`;
}
export function explorerTx(hash: string) {
  return `${CHAIN.explorer}/tx/${hash}`;
}
export function explorerBlock(n: number) {
  return `${CHAIN.explorer}/block/${n}`;
}
export function shortAddress(address: string, head = 6, tail = 4) {
  if (address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** USDG ("Global Dollar") on Robinhood Chain. Read on-chain: symbol USDG, 6 decimals. */
export const USDG = {
  address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  symbol: "USDG",
  name: "Global Dollar",
  decimals: 6,
} as const;

export const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

/** Chainlink ETH / USD on Robinhood Chain (verified on-chain). */
export const ETH_USD_FEED = "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9";

/**
 * Chart links: DEXTools only (owner decision 23 Oct 2026). Robinhood Chain is listed on DEXTools under the chain slug
 * "robinhood" (checked 23 Oct 2026: its pair pages are /app/robinhood/pair-explorer/<address>). The pair explorer
 * accepts a token address and opens its main pool. Change the slug or the pattern here only.
 */
export const DEXTOOLS_CHAIN = "robinhood";
export function chartUrl(address: string): string | null {
  return isAddress(address) ? `https://www.dextools.io/app/en/${DEXTOOLS_CHAIN}/pair-explorer/${address.toLowerCase()}` : null;
}


/**
 * Own-token launchpad: Pons on Robinhood Chain. Before the CA is real every buy button opens the launchpad home
 * and says "At launch"; afterwards it opens the token's own launchpad page.
 */
export const LAUNCHPAD = {
  name: "Pons",
  home: "https://ponsfamily.com/launchpad",
  tokenUrl: (address: string) => `https://ponsfamily.com/launchpad/${address.toLowerCase()}`,
} as const;

/** Where a buy button goes: the token page once the CA is real, else the launchpad home. Never disabled. */
export function buyUrl(): string {
  return isAddress(BRAND.ca) ? LAUNCHPAD.tokenUrl(BRAND.ca) : LAUNCHPAD.home;
}

/** Multicall3 at its canonical address (code present on chain 4663, checked 30 Oct 2026). Used for batched reads. */
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

/** Canonical Permit2 (code present on chain 4663, checked 30 Oct 2026). */
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/**
 * Spenders the quick check reads for every token in the list, even when no approval event was found. Uniswap's
 * addresses for chain 4663 (its published address book), each confirmed to hold code on 30 Oct 2026. A name here is a
 * fact about who deployed the address, not a judgement; community labels come from the NulloSpenderLabels contract.
 */
export const KNOWN_SPENDERS: readonly { address: string; name: string }[] = [
  { address: PERMIT2, name: "Permit2 (Uniswap)" },
  { address: "0x8876789976dEcBfCbBbe364623C63652db8C0904", name: "Uniswap Universal Router" },
  { address: "0x89E5Db8b5aa49aa85AC63F691524311AeB649eBA", name: "Uniswap v2 Router" },
  { address: "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3", name: "Uniswap v3 Positions" },
  { address: "0x58daec3116aae6D93017bAAea7749052E8a04fA7", name: "Uniswap v4 Positions" },
];
