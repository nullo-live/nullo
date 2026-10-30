/*
 * Spenders the quick check reads for every listed token, even when no approval event was found, and the names the
 * site shows for them. Picked from what wallets on Robinhood Chain actually approve: on 30 Oct 2026 a sample of
 * 80,404 ERC-20 Approval events (400 windows of 100 blocks spread over the last 40M blocks, 25,281 owners) was ranked
 * by distinct owners per spender. An address is listed only when
 *   - it holds contract code on chain 4663 (eth_getCode, 30 Oct 2026), and
 *   - its name is confirmed: published source on Sourcify (chain 4663) under that contract name, plus a wiring read
 *     where one exists (for example SwapRouter02.factory() is the Uniswap v3 factory, PonsV2Helper.factory() is the
 *     Pons V2 factory).
 * A name is a fact about the contract, not a judgement of it; community labels come from NulloSpenderLabels.
 * Busy spenders without published source (some with thousands of approving owners) are left out on purpose: the
 * site cannot say who runs them. The review hints still show "no published source" for those.
 */

export type KnownSpender = {
  address: string;
  name: string;
  /** Also read Permit2 allowance(owner, token, spender): the spender pulls tokens through Permit2. */
  permit2?: boolean;
  /** How the name was confirmed (kept for the notes and the /labels list). */
  how: string;
};

/** Canonical Permit2 (code present on chain 4663, checked 30 Oct 2026). */
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/**
 * Pons V2 on Robinhood Chain. Every Pons launch has its own bonding curve; selling on the curve needs an ERC-20
 * approval to that curve, so the quick check resolves each listed token's curve with
 * factory.getLaunchedToken(token) (src/lib/pons.ts) and reads allowance(owner, curve) as well.
 */
export const PONS = {
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  /** getLaunchedToken(address): static tuple, curve in word 1, exists in word 14. */
  getLaunchedToken: "0x3cf28b5a",
} as const;

export const KNOWN_SPENDERS: readonly KnownSpender[] = [
  { address: PERMIT2, name: "Permit2 (Uniswap)", how: "Uniswap address book for chain 4663; code present" },
  { address: "0x8876789976dEcBfCbBbe364623C63652db8C0904", name: "Uniswap Universal Router", permit2: true, how: "Uniswap address book for chain 4663; code present" },
  { address: "0x89e5DB8B5aA49aA85AC63f691524311AEB649eba", name: "Uniswap v2 Router", how: "Uniswap address book for chain 4663; code present" },
  { address: "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3", name: "Uniswap v3 Positions", how: "Uniswap address book for chain 4663; code present" },
  { address: "0x58daec3116aae6D93017bAAea7749052E8a04fA7", name: "Uniswap v4 Positions", permit2: true, how: "Uniswap address book for chain 4663; code present" },
  { address: "0xCaf681a66D020601342297493863E78C959E5cb2", name: "Uniswap SwapRouter02", how: "Sourcify name SwapRouter02; factory() = Uniswap v3 factory, factoryV2() = Uniswap v2 factory" },
  { address: "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948", name: "Pons V2 Launch and Buy", how: "Sourcify name PonsV2LaunchAndBuy; launchForwarder() of the Pons V2 factory" },
  { address: "0x8CF2969A0689f7514006e91F808a370f77E55bbD", name: "Pons V2 Helper", how: "Sourcify name PonsV2Helper (exact match); factory() = Pons V2 factory" },
  { address: "0xCcC88a9d1B4ED6b0EABA998850414b24f1c315bE", name: "Relay Approval Proxy v3", how: "Sourcify name RelayApprovalProxyV3" },
  { address: "0x5567954cD026CEbFE486062cb75848e0f1c12E58", name: "Relay Approval Proxy", how: "Sourcify name RelayApprovalProxy" },
  { address: "0x4cD00E387622C35bDDB9b4c962C136462338BC31", name: "Relay Depository", how: "Sourcify name RelayDepository (exact match)" },
  { address: "0x0000000000001fF3684f28c67538d4D072C22734", name: "0x AllowanceHolder", how: "Sourcify name AllowanceHolder; 0x's cross-chain address" },
  { address: "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5", name: "KyberSwap Meta Aggregation Router v2", how: "Sourcify name MetaAggregationRouterV2 (exact match); KyberSwap's cross-chain address" },
  { address: "0xB477751B76CF82d00a686A1232f5fCD772414Af3", name: "LI.FI Diamond", how: "Sourcify name LiFiDiamond" },
  { address: "0xBeEff033F34C046626B8D0A041844C5d1A5409dd", name: "Steakhouse USDG vault (steakUSDG)", how: "Sourcify name VaultV2; name() Steakhouse USDG, asset() USDG" },
];

/** Name the site shows for a spender address, or null. `curves` maps a Pons curve address to its token symbol. */
export function knownSpenderName(address: string, curves?: ReadonlyMap<string, string>): string | null {
  const a = address.toLowerCase();
  const hit = KNOWN_SPENDERS.find((k) => k.address.toLowerCase() === a);
  if (hit) return hit.name;
  const curve = curves?.get(a);
  return curve !== undefined ? `Pons bonding curve (${curve})` : null;
}
