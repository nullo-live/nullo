import { isAddress } from "@/config/brand";

/*
 * Nullo contract address on Robinhood Chain.
 *   labels  NulloSpenderLabels, no constructor arguments, no owner, does not need the $NULLO token.
 *           Deployed 30 Oct 2026 (block 101519218), verified on Blockscout.
 * Empty => labels and flags run in practice mode (signed with your wallet, kept in this browser, nothing sent).
 * The permission scanner, review and revoke queue never need this contract: they read and call the tokens themselves.
 * Check a deployment any time: `npm run verify-deployment -- --labels <address> --labels-tx <tx>`.
 */
const DEPLOYED = {
  labels: "0x72fcf9b2e8ed75822837e0021141e57b4daac1bc",
  /** Block of the NulloSpenderLabels deployment (first block worth reading its events from). */
  labelsBlock: 101519218,
};

/**
 * Local tests only: NEXT_PUBLIC_NULLO_TEST_CONTRACTS='{"labels":"0x…","labelsBlock":1}' at build time points a second
 * build at a contract deployed on an anvil chain. Never set it on Vercel.
 */
function testOverride(): typeof DEPLOYED | null {
  const raw = process.env.NEXT_PUBLIC_NULLO_TEST_CONTRACTS;
  if (!raw) return null;
  try {
    const v = { ...DEPLOYED, ...(JSON.parse(raw) as Partial<typeof DEPLOYED>) };
    return isAddress(v.labels) ? v : null;
  } catch {
    return null;
  }
}

export const CONTRACTS = testOverride() ?? DEPLOYED;

export const labelsLive = () => isAddress(CONTRACTS.labels);

export const CONTRACT_NAMES = { labels: "NulloSpenderLabels" } as const;
