"use client";

import { useMemo, useState } from "react";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CHAIN, explorerAddress, explorerTx } from "@/config/brand";
import { storageKey } from "@/config/storage";
import { explain, waitForReceipt } from "@/lib/client";

type Art = { creation: string; sha256: string };
type Progress = { labels?: string; labelsTx?: string; labelsBlock?: number };

/** Owner tool: deploys NulloSpenderLabels from the connected wallet. */
export function DeployPanel({ labels }: { labels: Art }) {
  const { address, onRobinhoodChain, sendTransaction, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  const [p, setP] = useLocalStore<Progress>(storageKey("deploy", String(CHAIN.id)), {});
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const say = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${s}`, ...l]);

  const snippet = useMemo(() => `const DEPLOYED = {\n  labels: "${p.labels ?? ""}",\n  labelsBlock: ${p.labelsBlock ?? 0},\n};`, [p]);

  async function deploy() {
    setBusy(true);
    try {
      const data = labels.creation as `0x${string}`;
      say(`NulloSpenderLabels: confirm in the wallet (${(data.length - 2) / 2} bytes)`);
      const hash = await sendTransaction({ data });
      say(`NulloSpenderLabels: sent ${hash}`);
      const r = await waitForReceipt(hash, 300_000);
      if (!r.ok || !r.contractAddress) throw new Error("NulloSpenderLabels deployment reverted");
      say(`NulloSpenderLabels: deployed at ${r.contractAddress} (block ${r.blockNumber})`);
      setP({ labels: r.contractAddress, labelsTx: hash, labelsBlock: r.blockNumber });
    } catch (e) {
      say(`failed: ${explain(e)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!address)
    return (
      <button type="button" className="nl-btn sm w-fit" onClick={open}>
        Connect the deployer wallet
      </button>
    );
  if (!onRobinhoodChain)
    return (
      <button type="button" className="nl-btn sm w-fit" onClick={switchNetwork}>
        Switch to {CHAIN.name}
      </button>
    );

  return (
    <div className="flex flex-col gap-4" data-testid="deploy-panel">
      <section className="nl-panel flex flex-col gap-3">
        <h2 className="font-mono text-[16px] font-medium">1 · NulloSpenderLabels (no arguments, no token)</h2>
        <p className="m-0 font-mono text-[12px] text-[var(--ink-70)]">Build sha256 {labels.sha256.slice(0, 16)}…</p>
        {p.labels ? (
          <p className="m-0 text-[14px]">
            Deployed at{" "}
            <a href={explorerAddress(p.labels)} target="_blank" rel="noreferrer" className="font-mono underline">
              {p.labels}
            </a>{" "}
            (block {p.labelsBlock},{" "}
            <a className="underline" href={explorerTx(p.labelsTx ?? "")} target="_blank" rel="noreferrer">
              tx
            </a>
            )
          </p>
        ) : (
          <button type="button" className="nl-btn sm w-fit" disabled={busy} data-testid="deploy-labels" onClick={deploy}>
            {busy ? "Deploying…" : "Deploy NulloSpenderLabels"}
          </button>
        )}
      </section>

      <section className="nl-panel flex flex-col gap-3">
        <h2 className="font-mono text-[16px] font-medium">2 · Paste into src/config/contracts.ts</h2>
        <pre className="overflow-x-auto nl-calldata !mt-0 rounded-[10px] font-mono text-[12.5px]" data-testid="deploy-snippet">
          {snippet}
        </pre>
        <p className="m-0 text-[13px] text-[var(--ink-70)]">
          Then run <code>npm run verify-deployment -- --labels {p.labels ?? "0x…"} --labels-tx {p.labelsTx ?? "0x…"}</code>, verify the source on the explorer (explorer kit), and remove this page.
        </p>
      </section>

      {log.length ? (
        <ul className="flex flex-col gap-1 font-mono text-[12px] text-[var(--ink-70)]" data-testid="deploy-log">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
