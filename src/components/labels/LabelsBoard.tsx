"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { AddressChip } from "@/components/site/CaCopy";
import { FlagIcon, TagIcon } from "@/components/site/Icons";
import { KNOWN_SPENDERS, explorerAddress, isAddress, shortAddress } from "@/config/brand";
import { CATEGORIES, REASONS } from "@/lib/abi";
import { explain, waitForReceipt } from "@/lib/client";
import { checkName, checkUrl, recentSpenders, recentUrls, spenderView, writeLabel, type LabelOp, type SpenderSummary, type SpenderView } from "@/lib/labels";

/** Lookup + write form for community labels. `?spender=0x…` opens one spender directly. */
export function LabelsBoard() {
  const params = useSearchParams();
  const router = useRouter();
  const { address, sendTransaction, signMessage, onRobinhoodChain, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  const [input, setInput] = useState(params.get("spender") ?? "");
  const spender = isAddress(params.get("spender") ?? "") ? (params.get("spender") as string) : null;
  const [view, setView] = useState<(SpenderView & { practice: boolean }) | null>(null);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [recent, setRecent] = useState<{ rows: SpenderSummary[]; total: number; practice: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(1);
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState(1);

  const load = useCallback(async () => {
    if (!spender) return;
    try {
      const v = await spenderView(spender, address);
      setErr(null);
      setView(v);
      recentUrls(spender).then(setUrls).catch(() => {});
    } catch (e) {
      setErr(explain(e));
    }
  }, [spender, address]);

  useEffect(() => {
    // load() only sets state after an await (a chain read), never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await recentSpenders().catch(() => ({ rows: [], total: 0, practice: false }));
      if (!cancelled) setRecent(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const mine = view?.labels.find((l) => address && l.author.toLowerCase() === address.toLowerCase()) ?? null;
  const known = spender ? KNOWN_SPENDERS.find((k) => k.address.toLowerCase() === spender.toLowerCase()) : null;

  const go = () => {
    const v = input.trim();
    if (!isAddress(v)) return setErr("Enter a 0x address of 40 hex characters.");
    router.push(`/labels?spender=${v}`);
  };

  const act = async (op: LabelOp) => {
    if (!address) return open();
    setBusy(true);
    setErr(null);
    setStatus(null);
    try {
      if (!view?.practice && !onRobinhoodChain) await switchNetwork();
      const { hash } = await writeLabel(op, { address, sendTransaction, signMessage });
      if (hash) {
        setStatus(`Sent ${shortAddress(hash, 10, 6)}. Waiting for the chain…`);
        const r = await waitForReceipt(hash);
        setStatus(r.ok ? `Confirmed in block ${r.blockNumber}.` : "The transaction failed on chain.");
      } else setStatus("Saved in this browser (practice mode, nothing sent).");
      await load();
    } catch (e) {
      setErr(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const nameErr = name ? checkName(name) : null;
  const urlErr = checkUrl(url);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="nl-panel">
          <label className="nl-field">
            <span>Spender address</span>
            <div className="flex flex-wrap gap-2">
              <input className="nl-input mono min-w-0 flex-1 basis-[260px]" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="0x…" spellCheck={false} data-testid="labels-input" />
              <button type="button" className="nl-btn md" onClick={go} data-testid="labels-go">
                Look up
              </button>
            </div>
          </label>
          {err ? <p className="nl-alert mt-4 mb-0">{err}</p> : null}
        </div>

        {spender && view ? (
          <div className="mt-6 grid gap-6" data-testid="labels-view">
            <div className="nl-panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="nl-kicker">Spender</p>
                  <p className="nl-mono m-0 mt-1 text-[15px] break-all">{spender}</p>
                  {known ? <span className="nl-tag mt-2">Listed on this site: {known.name}</span> : null}
                </div>
                <a href={explorerAddress(spender)} target="_blank" rel="noreferrer" className="nl-btn outline sm">
                  Explorer
                </a>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="nl-stat">
                  <p className="k">Labels</p>
                  <p className="v" data-testid="labels-count">
                    {view.count}
                  </p>
                </div>
                <div className="nl-stat">
                  <p className="k">Flags</p>
                  <p className="v" data-testid="flags-count">
                    {view.flags}
                  </p>
                </div>
                <div className="nl-stat col-span-2">
                  <p className="k">Flag reasons</p>
                  <p className="m-0 mt-1 text-[13px] leading-[20px]">{view.flags ? REASONS.map((r, i) => (i && view.byReason[i] ? `${r} ${view.byReason[i]}` : null)).filter(Boolean).join(" · ") : "None"}</p>
                </div>
              </div>
              {view.practice ? <p className="nl-note mt-4 mb-0">Practice mode: these entries live in this browser only. Once the contract is deployed, labels are read from the chain.</p> : null}
            </div>

            <div className="nl-table-wrap">
              <table className="nl-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Link</th>
                    <th>Author</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {view.labels.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="nl-empty">
                        No labels yet.
                      </td>
                    </tr>
                  ) : (
                    view.labels.map((l) => {
                      const link = l.url ?? urls.get(l.author.toLowerCase()) ?? null;
                      return (
                        <tr key={l.author}>
                          <td className="font-bold">{l.name}</td>
                          <td>{CATEGORIES[l.category] ?? "—"}</td>
                          <td className="max-w-[220px] break-all">
                            {link ? (
                              <a href={link} target="_blank" rel="noreferrer nofollow ugc" className="nl-link">
                                {link.replace(/^https:\/\//, "").slice(0, 48)}
                              </a>
                            ) : /^0x0+$/.test(l.urlHash) ? (
                              "—"
                            ) : (
                              <span className="nl-mono text-[12px] text-[var(--ink-55)]" title="Link hash; the text is in the label's event">
                                hash {l.urlHash.slice(0, 10)}…
                              </span>
                            )}
                          </td>
                          <td>
                            <AddressChip value={l.author} />
                          </td>
                          <td className="whitespace-nowrap">{l.updatedAt ? new Date(l.updatedAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="nl-panel">
                <p className="nl-kicker inline-flex items-center gap-2">
                  <TagIcon size={14} /> {mine ? "Update your label" : "Add your label"}
                </p>
                <div className="mt-4 grid gap-3">
                  <label className="nl-field">
                    <span>Name (1–32 plain characters)</span>
                    <input className="nl-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder={mine?.name ?? "e.g. Swap router of an app"} data-testid="label-name" />
                  </label>
                  {nameErr ? <p className="m-0 text-[13px] text-[var(--bad)]">{nameErr}</p> : null}
                  <label className="nl-field">
                    <span>Category</span>
                    <select className="nl-input" value={category} onChange={(e) => setCategory(Number(e.target.value))} data-testid="label-category">
                      {CATEGORIES.slice(1).map((c, i) => (
                        <option key={c} value={i + 1}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="nl-field">
                    <span>Link (optional, https://)</span>
                    <input className="nl-input mono" value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://docs.example.org" data-testid="label-url" />
                  </label>
                  {urlErr ? <p className="m-0 text-[13px] text-[var(--bad)]">{urlErr}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="nl-btn sm" disabled={busy || !name || Boolean(nameErr) || Boolean(urlErr)} onClick={() => act({ kind: "label", spender, name, category, url })} data-testid="label-save">
                      {address ? (view.practice ? "Sign and save" : "Write label") : "Connect to write"}
                    </button>
                    {mine ? (
                      <button type="button" className="nl-btn outline sm" disabled={busy} onClick={() => act({ kind: "remove", spender })} data-testid="label-remove">
                        Remove mine
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="nl-panel">
                <p className="nl-kicker inline-flex items-center gap-2">
                  <FlagIcon size={14} /> Flag this spender
                </p>
                <p className="nl-small mt-3">A flag is a public note with a reason, one per wallet. It never hides the spender or its labels.</p>
                {view.myFlag ? (
                  <div className="mt-4">
                    <p className="m-0 text-[14px]">
                      Your flag: <b>{REASONS[view.myFlag]}</b>
                    </p>
                    <button type="button" className="nl-btn outline sm mt-3" disabled={busy} onClick={() => act({ kind: "unflag", spender })} data-testid="unflag">
                      Take my flag back
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3">
                    <label className="nl-field">
                      <span>Reason</span>
                      <select className="nl-input" value={reason} onChange={(e) => setReason(Number(e.target.value))} data-testid="flag-reason">
                        {REASONS.slice(1).map((c, i) => (
                          <option key={c} value={i + 1}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="nl-btn danger sm w-fit" disabled={busy} onClick={() => act({ kind: "flag", spender, reason })} data-testid="flag-save">
                      {address ? (view.practice ? "Sign and flag" : "Flag spender") : "Connect to flag"}
                    </button>
                  </div>
                )}
              </div>
            </div>
            {status ? (
              <p className="nl-note m-0" data-testid="labels-status">
                {status}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <aside className="nl-panel h-fit" aria-label="Recently labelled spenders">
        <p className="nl-kicker">{recent?.practice ? "In this browser (practice)" : "Recently labelled"}</p>
        <p className="m-0 mt-1 text-[22px] font-bold">{recent ? `${recent.total} spender${recent.total === 1 ? "" : "s"}` : "—"}</p>
        <ul className="m-0 mt-4 grid list-none gap-2 p-0" data-testid="recent-spenders">
          {(recent?.rows ?? []).slice(0, 20).map((r) => (
            <li key={r.spender}>
              <Link href={`/labels?spender=${r.spender}`} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line-soft)] px-3 py-2 text-[13px] no-underline hover:bg-white">
                <span className="min-w-0 truncate">
                  <b>{r.topName ?? "Unnamed"}</b> <span className="nl-mono text-[var(--ink-55)]">{shortAddress(r.spender, 6, 4)}</span>
                </span>
                <span className="shrink-0 text-[12px] text-[var(--ink-55)]">
                  {r.labels}L · {r.flags}F
                </span>
              </Link>
            </li>
          ))}
          {recent && recent.rows.length === 0 ? <li className="nl-small">Nothing yet. Look up a spender and add the first label.</li> : null}
        </ul>
        <p className="nl-kicker mt-6">Known spenders</p>
        <ul className="m-0 mt-2 grid list-none gap-1 p-0">
          {KNOWN_SPENDERS.map((k) => (
            <li key={k.address}>
              <Link href={`/labels?spender=${k.address}`} className="nl-arrow-link !text-[13px]">
                {k.name}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
