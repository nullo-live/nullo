# Nullo

Every time a wallet trades, lists an NFT or uses a vault, it may leave a permission behind: the token records that some address can move its balance, and that record stays open after the app is closed. Nullo is a web app for Robinhood Chain that finds those permissions for any address, reads which of them are still open right now, shows who holds each one, and prepares the transaction that closes it for the owner's own wallet to sign.

Your Wallet. Your Permissions. Building a clearer way to review onchain access.

## Read this before anything else

This repository is the working code behind https://nullo.live.

- **What runs today.** The permission scanner (ERC-20 allowances, NFT collection operators, single-NFT approvals and Permit2 allowances) with scan coverage you can resume (from the last 15 minutes up to 7 days, 30 days or the whole chain, progress kept in the browser), a quick check against 15 known spenders plus each token's Pons bonding curve, the dashboard, the per-spender review with factual hints, the revoke queue that shows the exact call data and asks the wallet to sign one transaction at a time (or all rows in one atomic EIP-5792 batch when the wallet supports it), the approval history that was found, a hand check for any token and spender pair, deep links (`/app?owner=0x…&spender=0x…`), the public read endpoint `GET /api/approvals?owner=0x…`, and community labels on chain.
- **What reads live data.** Approval events and current allowances come from Robinhood Chain through the site's read relay (`/api/rpc`), batched through Multicall3. The token list for the quick check comes from GeckoTerminal's public API. ETH / USD comes from the Chainlink feed on Robinhood Chain. Full approval history from the Blockscout API is used only when the site has an API key.
- **The contract.** `NulloSpenderLabels` lets any wallet attach one label (name, category, link) to a spender address and flag a spender with a reason. It is **deployed on Robinhood Chain** at `0x72fcf9b2e8ed75822837e0021141e57b4daac1bc` (block 101519218), its source is verified on Blockscout, and `verify-deployment` matches it against this repository. The scanner and the revoke queue do not depend on it.
- **Planned, not built.** Approval alerts, premium monitoring, keyed developer access with higher limits, and any utility for $NULLO. The $NULLO token has not launched; its contract address is not published yet.
- **What nothing here claims.** Nullo does not make a wallet safe and cannot undo a transfer that already happened. Hints and community labels are information, not verdicts. $NULLO has no promised value.

## Layout

| Path | What it is |
|---|---|
| `src/app/` | Pages (home, `/app`, `/labels`, guides, glossary, limits, contract, privacy, token), `contracts.json`, `llms.txt`, and API routes (`/api/rpc`, `/api/chain`, `/api/tokens`, `/api/explorer`, `/api/approvals`). |
| `src/components/` | Interface components: workspace, labels board, wallet dialog and account menu, home sections. |
| `src/config/` | `brand.ts` (name, ticker, token address, links, chain), `spenders.ts` (the 15 known spenders and how each was confirmed), `contracts.ts` (deployed contract address and block) and `wallets.ts`. Every brand value is read from here. |
| `src/lib/` | Permission model and revoke calls (`approvals.ts`), browser scanning (`scan.ts`) and saved coverage (`coverage.ts`), Pons curves (`pons.ts`), EIP-5792 batches (`batch.ts`), the read API shape (`approvals-api.ts`), labels (`labels.ts`), the relay rules (`relay.ts`), server reads (`server/`) and their tests. |
| `src/content/` | FAQ and guide texts. |
| `contracts/` | Solidity source (`src/NulloSpenderLabels.sol`), Foundry tests (`test/`), and test-only mock tokens (`test/mocks/`). |
| `scripts/` | `verify-deployment` and the contract artifact builder. |
| `public/` | Brand images and wallet logos. |

## Run the tests

Node.js 20 or newer.

```
npm install
npm run typecheck
npm test
```

Contracts use [Foundry](https://book.getfoundry.sh/):

```
cd contracts
bash setup.sh
forge test --no-match-path "test/fork/*"
forge test --match-path "test/fork/*" --fork-url https://robinhood.drpc.org --evm-version cancun
```

### What was checked for this snapshot

- 2026-10-30 (UTC), Node.js 25.8.2, forge 1.5.1, run again when this README was updated: `npm run typecheck` exit 0; `npm test` 79 pass / 0 fail (permission model, revoke call data, scan coverage including a flood of fake approvals and a crowded block window, Pons curves, EIP-5792 batches, read API shape, quick check, relay request shapes and budgets, labels rules, rate limits, ABI against the compiled contract, verify-deployment against a fake chain); `npm run build` generated 24 static pages (27 entries in the route table, including 5 API routes); `forge test` 28 passed (24 unit and fuzz tests, 4 invariant tests at 64 runs x 48 calls); fork tests 2 passed against Robinhood Chain (ArbSys block number, a real `approve(spender, 0)` on USDG clears the allowance); `npm run verify-deployment` against the live `NulloSpenderLabels` printed MATCH (runtime code and creation input).
- Browser runs on a local chain with id 4663 (wallet injected through EIP-6963) were done earlier the same day during development and were not run again for this snapshot: scan, review hints, call data shown before signing, revokes signed one by one and as one EIP-5792 batch, deep links, labels written, updated, flagged and unflagged from two wallets. They need a local Foundry chain and are not part of `npm test`.

## Look at the site

```
npm install
npm run build
npm start
```

Open http://localhost:5910. Everything works with no configuration: scanning, review, revoke queue, guides, the read API, and labels read from and written to the deployed contract. Without `BLOCKSCOUT_API_KEY` the "Explorer history" source shows "not configured on this site yet" and the scan uses chain events plus the quick check. Without `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` the WalletConnect row says it is not configured; browser wallets still connect.

## Contracts

| Contract | Address | Explorer |
|---|---|---|
| NulloSpenderLabels | `0x72fcf9b2e8ed75822837e0021141e57b4daac1bc` (block 101519218, creation tx `0x98b00a7787ad1fea0effb47a6e01b97485d6abb9dd1b355b80afe30a054dd7ac`) | https://robinhoodchain.blockscout.com/address/0x72fcf9b2e8ed75822837e0021141e57b4daac1bc (source verified) |

`NulloSpenderLabels` records community notes about spender addresses: one label per wallet per spender (a name of 1 to 32 plain characters, a category code 1 to 8, an optional https link whose text is in the event and whose keccak-256 hash is stored), and at most one flag per wallet per spender with a reason code 1 to 6. It counts labels and flags per spender and lists every spender in first-seen order. It has no owner, no admin, no fee, no pause and no upgrade path, takes no constructor arguments, never calls a token and holds no funds (no payable function, no receive, no fallback). It never hides or ranks anything.

## Verify a deployment

```
npm run verify-deployment -- --labels <address> --labels-tx <creation transaction hash>
```

For the live contract:

```
npm run verify-deployment -- --labels 0x72fcf9b2e8ed75822837e0021141e57b4daac1bc --labels-tx 0x98b00a7787ad1fea0effb47a6e01b97485d6abb9dd1b355b80afe30a054dd7ac
```

The script compares the bytecode on Robinhood Chain with the build in this repository and prints MATCH or the first difference. It printed MATCH on 2026-10-30.

## Add the network to your wallet

| Field | Value |
|---|---|
| Network | Robinhood Chain |
| Chain ID | 4663 |
| Currency | ETH |
| RPC | https://rpc.mainnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com |

The site offers to add it when you connect.

## Data sources and limits

- **Robinhood Chain RPC** (official endpoint first, public fallbacks after it): approval events, allowances, Permit2 allowances, operator approvals, spender code, block times, labels. The relay accepts only the request shapes the site sends and charges a budget per network and site-wide.
- **Event windows.** Public endpoints answer event searches over at most 30,000 blocks per request, and the chain produces many blocks per second, so the scan reads the window the user picks in 30,000-block steps (newest first), shows which blocks it read and which it did not, and keeps that progress in the browser so a long window, up to the whole chain, can be finished over several visits. Approvals in blocks not read yet are found by the quick check, by a hand check, or by the explorer history.
- **Quick check.** Up to 100 tokens from GeckoTerminal's top pools on Robinhood Chain (cached 30 minutes) plus USDG and WETH, checked against 15 spenders whose contract name is published on Sourcify for chain 4663 (Permit2, Uniswap routers and position managers, Pons V2 helpers, Relay, 0x, KyberSwap, LI.FI and a USDG vault; the list and how each was confirmed are in `src/config/spenders.ts`), plus each token's own Pons bonding curve, directly and through Permit2.
- **Read API.** `GET /api/approvals?owner=0x…` returns the open permissions of one owner with labels, counts and the block coverage behind them. No key, CORS open for GET, rate limited per IP, cached about two minutes.
- **Blockscout API** (optional key): whole-chain approval history and whether a spender's source is published.
- **Chainlink ETH / USD** on Robinhood Chain for the live line; GeckoTerminal for $NULLO market data after launch.
- Anything that does not answer is shown as "—" or "Unreadable", never as closed or zero.

## Token

$NULLO is the community token of Nullo on Robinhood Chain. It has not launched yet; the contract address will be published on https://nullo.live and https://x.com/nullolive at launch, and any address seen before that is not ours. It has no promised value. Analytics credits, premium alerts, monitoring and a developer API are planned uses; none of them is built.

## Deploy your own

1. Import the repository into a Next.js host (framework preset Next.js, root `./`). No environment variable is required.
2. Optional environment variables:

| Variable | What it is for | Format |
|---|---|---|
| `ROBINHOOD_RPC_URL` | Server-side chain reads (relay, live line) | https URL |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Browser fallback endpoint | https URL |
| `BLOCKSCOUT_API_KEY` | Explorer history and source checks | `proapi_…` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect option in the wallet dialog | 32 hex characters |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Shared rate-limit counters across server instances | https URL / token |

3. Point the domain at the deployment, then check `/` (200) and `/api/chain` (JSON with a block number).
4. Contract: `src/config/contracts.ts` points at the deployed `NulloSpenderLabels` above, so a fork reads the same community labels. To use your own, deploy `NulloSpenderLabels` (no constructor arguments, about 1.85M gas), put its address and deployment block in `src/config/contracts.ts`, and run `npm run verify-deployment`.

## Contributing

Fork the repository, branch from `main`, and run `npm run typecheck`, `npm test` and `npm run build`, and `bash setup.sh && forge test` in `contracts/` before opening a pull request. For a bug, open an issue with the expected and actual behavior and minimal steps. Keep private keys, seed phrases and environment values out of issues.

## Security

Please do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. The contract, the API routes (especially the read relay) and the building of revoke transactions are in scope; wallets, RPC providers, explorers, token contracts and launchpads are not. There is no bug bounty.

## Notices and license

This project's original code is released under the [MIT License](LICENSE). The Nullo mark (the olive "n") and banner in `public/brand/` and `src/app/` are the project's own artwork. Fonts are loaded through `next/font` (Nunito Sans and JetBrains Mono, SIL Open Font License). Wallet logos in `public/wallets/` belong to their projects and are used only to identify each wallet. Multicall3 and Permit2 are third-party contracts the site reads; their code is not part of this repository. The Nullo name, logo and artwork belong to the project and are not licensed for reuse as a brand.
