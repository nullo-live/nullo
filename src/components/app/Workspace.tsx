"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAddress } from "viem";
import { useChain } from "@/components/providers/ChainProvider";
import { AddressChip } from "@/components/site/CaCopy";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CHAIN, KNOWN_SPENDERS, PERMIT2, explorerAddress, explorerTx, isAddress, knownSpenderName, shortAddress } from "@/config/brand";
import { labelsLive } from "@/config/contracts";
import { storageKey } from "@/config/storage";
import {
  KIND_WORDS,
  barePair,
  formatAmount,
  hintsFor,
  isOpen,
  mergePairs,
  pairsFrom,
  revokeCall,
  type ApprovalEvent,
  type Current,
  type Kind,
  type Pair,
  type RawLog,
  decodeLog,
} from "@/lib/approvals";
import { explain, rpcCall, waitForReceipt } from "@/lib/client";
import { practiceLoad } from "@/lib/labels";
import type { ApiAnswer } from "@/lib/approvals-api";
import type { BatchSupport } from "@/lib/batch";
import { describeCoverage, fromCursor, mergeRanges, toCursor, type Range } from "@/lib/coverage";
import { blockTimes, hasCode, labelCounts, quickCheck, readCurrent, scanCoverage, tokenMeta, type LabelFacts, type ScanProgress, type TokenMeta } from "@/lib/scan";

/*
 * The permission workspace: scan an address, list what is open now, review spenders, queue revokes the user's own wallet
 * signs (one by one, or in one EIP-5792 batch when the wallet offers atomic batches), and read the approval history
 * that was found. Read-only until the user presses a sign button.
 * Deep link: /app?owner=0x…[&spender=0x…][&tab=review] fills the address, starts the scan and filters to one spender.
 */

type Tab = "dashboard" | "review" | "revoke" | "history" | "check";
const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "review", label: "Review" },
  { id: "revoke", label: "Revoke" },
  { id: "history", label: "History" },
  { id: "check", label: "Check a pair" },
];

/** Event windows. `seconds: 0` = the whole chain from block 1 (read over several visits; progress is kept). */
const DEPTHS = [
  { id: "quarter", label: "Last 15 minutes", seconds: 900 },
  { id: "hour", label: "Last hour", seconds: 3600 },
  { id: "six", label: "Last 6 hours", seconds: 6 * 3600 },
  { id: "day", label: "Last 24 hours", seconds: 24 * 3600 },
  { id: "week", label: "Last 7 days", seconds: 7 * 86_400 },
  { id: "month", label: "Last 30 days", seconds: 30 * 86_400 },
  { id: "all", label: "Whole chain (resumable)", seconds: 0 },
] as const;

const SOURCE_WORDS: Record<string, string> = { logs: "Chain events", quick: "Known spenders", explorer: "Explorer history", manual: "Checked by hand", server: "Site scan" };
const LAST_KEY = storageKey("app", "last");
const queueKey = (owner: string) => storageKey("queue", owner.toLowerCase());
const cursorKey = (owner: string) => storageKey("cursor", owner.toLowerCase());

function loadCursor(owner: string) {
  try {
    return fromCursor(JSON.parse(window.localStorage.getItem(cursorKey(owner)) ?? "null"), owner);
  } catch {
    return null;
  }
}
function saveCursor(owner: string, ranges: Range[], events: ApprovalEvent[]) {
  try {
    window.localStorage.setItem(cursorKey(owner), JSON.stringify(toCursor(owner, ranges, events)));
  } catch {
    // storage full or blocked: progress lives only in this tab
  }
}
const fmt = (n: number) => n.toLocaleString("en-US");

type Row = { pair: Pair; cur: Current | undefined; open: boolean };
type QItem = { key: string; kind: Kind; token: string; spender: string; tokenId: string | null; state: "queued" | "sending" | "done" | "failed"; tx?: string; note?: string };

function loadQueue(owner: string): QItem[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(queueKey(owner)) ?? "[]") as QItem[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function saveQueue(owner: string, q: QItem[]) {
  try {
    window.localStorage.setItem(queueKey(owner), JSON.stringify(q));
  } catch {
    // storage blocked: the queue lives only in memory
  }
}
const pairOf = (q: QItem): Pair => barePair(q.kind, q.token, q.spender, "queue", q.tokenId === null ? null : BigInt(q.tokenId));

export function Workspace() {
  const params = useSearchParams();
  const { address, sendTransaction, onRobinhoodChain, switchNetwork, batchSupport, sendBatch, batchStatus } = useWallet();
  const { open: openWallet } = useWalletModal();
  const { facts } = useChain();
  const [tab, setTab] = useState<Tab>((TABS.find((t) => t.id === params.get("tab"))?.id ?? "dashboard") as Tab);
  const linkOwner = params.get("owner") ?? params.get("address") ?? "";
  const linkSpender = params.get("spender") ?? "";
  const [input, setInput] = useState(isAddress(linkOwner) ? linkOwner : "");
  const [spenderFilter, setSpenderFilter] = useState<string | null>(isAddress(linkSpender) ? getAddress(linkSpender) : null);
  const [owner, setOwner] = useState<string | null>(null);
  const [depth, setDepth] = useState<(typeof DEPTHS)[number]["id"]>("hour");
  const [useLogs, setUseLogs] = useState(true);
  const [useQuick, setUseQuick] = useState(true);
  const [useExplorer, setUseExplorer] = useState(true);
  const [explorerOn, setExplorerOn] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Map<string, Pair>>(new Map());
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [current, setCurrent] = useState<Map<string, Current>>(new Map());
  const [meta, setMeta] = useState<Map<string, TokenMeta>>(new Map());
  const [code, setCode] = useState<Map<string, boolean | null>>(new Map());
  const [labels, setLabels] = useState<Map<string, LabelFacts> | null>(null);
  const [times, setTimes] = useState<Map<number, number>>(new Map());
  const [verified, setVerified] = useState<Map<string, boolean | null>>(new Map());
  const [scanned, setScanned] = useState<{ lo: number; head: number; ranges: Range[]; at: number; paused: boolean } | null>(null);
  const [curves, setCurves] = useState<Map<string, string>>(new Map());
  const [serverLabels, setServerLabels] = useState<Map<string, string>>(new Map());
  const [showClosed, setShowClosed] = useState(false);
  const [queue, setQueue] = useState<QItem[]>([]);
  const stop = useRef({ stopped: false });

  useEffect(() => {
    fetch("/api/explorer")
      .then((r) => r.json())
      .then((v: { configured?: boolean }) => setExplorerOn(Boolean(v.configured)))
      .catch(() => setExplorerOn(false));
    try {
      const last = JSON.parse(window.localStorage.getItem(LAST_KEY) ?? "null") as { depth?: string; address?: string } | null;
      if (last?.depth && DEPTHS.some((d) => d.id === last.depth)) setDepth(last.depth as never);
      if (!isAddress(linkOwner) && last?.address) setInput(last.address);
    } catch {
      // nothing saved
    }
  }, [params, linkOwner]);

  // A freshly connected wallet fills an empty address box.
  useEffect(() => {
    if (address && !input) setInput(address);
  }, [address, input]);

  useEffect(() => {
    if (owner) setQueue(loadQueue(owner));
  }, [owner]);
  const updateQueue = useCallback(
    (fn: (q: QItem[]) => QItem[]) => {
      setQueue((q) => {
        const next = fn(q);
        if (owner) saveQueue(owner, next);
        return next;
      });
    },
    [owner],
  );

  const pace = facts?.blockPace && facts.blockPace > 0 ? facts.blockPace : 0.104;
  const depthBlocks = Math.round(DEPTHS.find((d) => d.id === depth)!.seconds / pace);
  const head = facts?.block ?? null;

  /** Fills in everything a list of pairs needs: current state, token facts, spender code, labels, event times. */
  const enrich = useCallback(async (who: string, list: Pair[], evs: ApprovalEvent[]) => {
    setPhase("Reading the current state of every pair…");
    const cur = await readCurrent(who, list);
    setCurrent((m) => new Map([...m, ...cur]));
    setPhase("Reading token names and spender code…");
    const tokens = [...new Set(list.map((p) => p.token.toLowerCase()))];
    const spenders = [...new Set(list.map((p) => p.spender.toLowerCase()))];
    const [m, c, l, t] = await Promise.all([
      tokenMeta(tokens),
      hasCode(spenders),
      labelCounts(spenders).catch(() => null),
      blockTimes([...list.map((p) => p.last?.block).filter((b): b is number => typeof b === "number"), ...evs.slice(-40).map((e) => e.block)]),
    ]);
    setMeta((x) => new Map([...x, ...m]));
    setCode((x) => new Map([...x, ...c]));
    setTimes((x) => new Map([...x, ...t]));
    if (l) setLabels((x) => new Map([...(x ?? []), ...l]));
    else if (!labelsLive()) {
      const s = practiceLoad();
      const pm = new Map<string, LabelFacts>();
      for (const sp of spenders) pm.set(sp, { labels: (s.labels[sp] ?? []).length, flags: Object.keys(s.flags[sp] ?? {}).length, byReason: [], byCategory: [] });
      setLabels(pm);
    }
  }, []);

  const scan = async (override?: string) => {
    const who = (override ?? input).trim();
    if (!isAddress(who)) return setError("Enter a wallet address: 0x followed by 40 hex characters.");
    const ownerAddr = getAddress(who);
    setError(null);
    setNotes([]);
    setOwner(ownerAddr);
    setPairs(new Map());
    setEvents([]);
    setCurrent(new Map());
    setProgress(null);
    setScanned(null);
    setRunning(true);
    stop.current = { stopped: false };
    try {
      window.localStorage.setItem(LAST_KEY, JSON.stringify({ depth, address: ownerAddr }));
    } catch {
      // ignore
    }
    const note = (s: string) => setNotes((n) => [...n, s]);
    try {
      setPhase("Reading the chain head…");
      const head = Number(BigInt(await rpcCall<string>("eth_blockNumber", [])));
      const lo = depthBlocks === 0 ? 1 : Math.max(1, head - depthBlocks + 1);
      const tasks: Promise<Map<string, Pair>>[] = [];
      let allEvents: ApprovalEvent[] = [];

      if (useQuick) {
        tasks.push(
          (async () => {
            // The site's own read first (known spenders + Pons curves + its event windows, cached); the same quick
            // check through the relay when that is busy.
            const r = await fetch(`/api/approvals?owner=${ownerAddr}`, { cache: "no-store" });
            if (r.ok) {
              const a = (await r.json()) as ApiAnswer;
              const labelsFrom = new Map<string, string>();
              const out = new Map<string, Pair>();
              for (const x of a.approvals) {
                const p = barePair(x.kind, x.token, x.spender, "quick", x.tokenId === null ? null : BigInt(x.tokenId));
                p.source = new Set(x.foundBy.map((f) => (f === "logs" ? "server" : f)));
                out.set(p.key, p);
                if (x.spenderLabel) labelsFrom.set(x.spender.toLowerCase(), x.spenderLabel);
              }
              setServerLabels((m) => new Map([...m, ...labelsFrom]));
              const c = a.coverage;
              note(
                `Site read: ${a.coverage.quickCheck.tokens} tokens × ${KNOWN_SPENDERS.length} known spenders + Pons curves (${fmt(c.quickCheck.pairs)} pairs)` +
                  (c.source === "blockscout" ? ", plus explorer history" : c.fromBlock !== null ? `, plus its event windows from block ${fmt(c.fromBlock)}` : "") +
                  `: ${a.counts.open} open${a.cached ? " (cached)" : ""}.`,
              );
              return out;
            }
            const res = await fetch("/api/tokens").then((x) => x.json() as Promise<{ list: { address: string; symbol: string; curve?: string | null }[] }>);
            setCurves(new Map(res.list.filter((t) => t.curve).map((t) => [t.curve!.toLowerCase(), t.symbol])));
            const q = await quickCheck(ownerAddr, res.list);
            note(`Quick check: ${res.list.length} tokens × ${KNOWN_SPENDERS.length} known spenders + Pons curves (${fmt(q.read)} pairs), ${q.open.length} open.`);
            setCurrent((m) => new Map([...m, ...q.current]));
            return new Map(q.open.map((p) => [p.key, p]));
          })().catch((e) => {
            note(`Quick check did not finish: ${explain(e)}`);
            return new Map<string, Pair>();
          }),
        );
      }
      if (useExplorer && explorerOn) {
        tasks.push(
          (async () => {
            const r = await fetch(`/api/explorer?op=history&owner=${ownerAddr}`).then((x) => x.json() as Promise<{ configured?: boolean; logs?: RawLog[]; capped?: boolean; error?: string }>);
            if (!r.logs) {
              note(`Explorer history unavailable: ${r.error ?? "not configured"}.`);
              return new Map<string, Pair>();
            }
            const evs = r.logs.map((l) => decodeLog(l, PERMIT2)).filter((e): e is ApprovalEvent => Boolean(e));
            allEvents = [...allEvents, ...evs];
            note(`Explorer history: ${evs.length} approval events over the whole chain${r.capped ? " (first pages only)" : ""}.`);
            return pairsFrom(evs, "explorer");
          })().catch(() => {
            note("Explorer history did not answer; chain reads still work.");
            return new Map<string, Pair>();
          }),
        );
      }
      if (useLogs) {
        tasks.push(
          (async () => {
            // Blocks read on earlier visits are kept per owner and skipped; only what is missing is read.
            const saved = loadCursor(ownerAddr);
            const before = saved?.ranges ?? [];
            const r = await scanCoverage(ownerAddr, lo, head, before, (p) => setProgress(p), stop.current);
            const ranges = mergeRanges([...before, ...r.ranges]);
            const evs = [...(saved?.events ?? []), ...r.events];
            saveCursor(ownerAddr, ranges, evs);
            allEvents = [...allEvents, ...evs];
            setScanned({ lo, head, ranges, at: Date.now(), paused: r.paused || Boolean(r.error) || stop.current.stopped });
            const d = describeCoverage(ranges, lo, head);
            note(
              `Chain events: ${d.percent.toFixed(d.percent < 10 ? 2 : 1)}% of blocks ${fmt(lo)}–${fmt(head)} read (${fmt(r.queries)} new windows, ${r.events.length} new events, ${evs.length} in total).` +
                (r.paused ? ` Paused: ${r.error} Press Scan again later to continue where it stopped.` : r.error ? ` Stopped early: ${r.error}` : "") +
                (stop.current.stopped ? " Stopped by you; progress is kept." : ""),
            );
            return pairsFrom(evs, "logs");
          })(),
        );
      }
      const maps = await Promise.all(tasks);
      // Events from two sources can repeat: keep one per (tx, log index).
      const seen = new Set<string>();
      allEvents = allEvents.filter((e) => {
        const k = `${e.tx}:${e.logIndex}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const merged = mergePairs(...maps);
      setEvents(allEvents.sort((a, b) => b.block - a.block || b.logIndex - a.logIndex));
      setPairs(merged);
      await enrich(ownerAddr, [...merged.values()], allEvents);
      setPhase(null);
    } catch (e) {
      setError(explain(e));
      setPhase(null);
    } finally {
      setRunning(false);
    }
  };

  // A deep link with ?owner= starts the scan once.
  const autoStarted = useRef(false);
  useEffect(() => {
    // Waits for the explorer answer, so a configured explorer history is part of the first scan.
    if (autoStarted.current || !isAddress(linkOwner) || explorerOn === null) return;
    autoStarted.current = true;
    void scan(linkOwner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkOwner, explorerOn]);

  const forgetProgress = () => {
    if (!owner) return;
    try {
      window.localStorage.removeItem(cursorKey(owner));
    } catch {
      // ignore
    }
    setScanned(null);
    setNotes((n) => [...n, "Saved scan progress for this address was cleared."]);
  };

  // Explorer source check for spenders with code (only when the site has the key), a few at a time.
  useEffect(() => {
    if (!explorerOn) return;
    const todo = [...code.entries()].filter(([a, has]) => has && !verified.has(a)).slice(0, 20);
    if (todo.length === 0) return;
    let cancelled = false;
    Promise.all(todo.map(([a]) => fetch(`/api/explorer?op=source&address=${a}`).then((r) => r.json() as Promise<{ verified?: boolean | null }>).catch(() => ({ verified: null })))).then((res) => {
      if (cancelled) return;
      setVerified((m) => {
        const n = new Map(m);
        todo.forEach(([a], i) => n.set(a, res[i].verified ?? null));
        return n;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [code, explorerOn, verified]);

  const now = Math.floor(Date.now() / 1000);
  const rows: Row[] = useMemo(
    () =>
      [...pairs.values()]
        .map((p) => {
          const cur = current.get(p.key);
          return { pair: p, cur, open: isOpen(p, cur, now) };
        })
        .sort((a, b) => Number(b.open) - Number(a.open) || (b.pair.last?.block ?? 0) - (a.pair.last?.block ?? 0)),
    [pairs, current, now],
  );
  const matches = (r: Row) => !spenderFilter || r.pair.spender.toLowerCase() === spenderFilter.toLowerCase();
  const openRows = rows.filter((r) => r.open && matches(r));
  const shown = (showClosed ? rows : openRows).filter(matches);
  const tokenName = (t: string) => meta.get(t.toLowerCase())?.symbol ?? shortAddress(t, 6, 4);
  const spenderName = (s: string) => knownSpenderName(s, curves) ?? serverLabels.get(s.toLowerCase()) ?? null;
  const changedAt = (p: Pair) => (p.last ? (times.get(p.last.block) ?? null) : null);
  const facts4 = (s: string) => {
    const l = labels?.get(s.toLowerCase());
    return { hasCode: code.get(s.toLowerCase()) ?? null, labels: l ? l.labels : null, flags: l ? l.flags : null, knownName: spenderName(s), verified: verified.get(s.toLowerCase()) ?? null };
  };
  const inQueue = (k: string) => queue.some((q) => q.key === k && q.state !== "done");
  const enqueue = (p: Pair) =>
    updateQueue((q) => (q.some((x) => x.key === p.key && x.state !== "done") ? q : [...q.filter((x) => x.key !== p.key), { key: p.key, kind: p.kind, token: p.token, spender: p.spender, tokenId: p.tokenId === null ? null : p.tokenId.toString(), state: "queued" }]));

  const amountOf = (r: Row) => formatAmount(r.pair.kind, r.cur?.amount ?? null, meta.get(r.pair.token.toLowerCase())?.decimals ?? null);
  const ownerIsMe = Boolean(owner && address && owner.toLowerCase() === address.toLowerCase());

  return (
    <div className="grid gap-6">
      {/* Address + settings */}
      <div className="nl-panel" data-testid="scan-panel">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="nl-field">
            <span>Wallet address to read (connected or pasted, read-only)</span>
            <input className="nl-input mono" value={input} onChange={(e) => setInput(e.target.value.trim())} onKeyDown={(e) => e.key === "Enter" && !running && scan()} placeholder="0x…" spellCheck={false} data-testid="scan-input" />
          </label>
          <div className="flex flex-wrap gap-2">
            {address && input.toLowerCase() !== address.toLowerCase() ? (
              <button type="button" className="nl-btn outline md" onClick={() => setInput(address)}>
                Use my wallet
              </button>
            ) : null}
            {!address ? (
              <button type="button" className="nl-btn outline md" onClick={openWallet} data-testid="scan-connect">
                Connect
              </button>
            ) : null}
            {running ? (
              <button type="button" className="nl-btn md" onClick={() => (stop.current.stopped = true)} data-testid="scan-stop">
                Stop scan
              </button>
            ) : (
              <button type="button" className="nl-btn md" onClick={() => scan()} data-testid="scan-go">
                {scanned?.paused ? "Continue scan" : "Scan permissions"}
              </button>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px]">
          <label className="inline-flex items-center gap-2">
            <span className="font-semibold">Event window</span>
            <select className="nl-input !min-h-[36px] !w-auto !py-1" value={depth} onChange={(e) => setDepth(e.target.value as never)} data-testid="scan-depth">
              {DEPTHS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <span className="text-[var(--ink-55)]">≈ {fmt(depthBlocks === 0 ? (head ?? 0) : depthBlocks)} blocks{depthBlocks === 0 || depthBlocks > 3_000_000 ? ", read over several visits; progress is kept" : ""}</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={useLogs} onChange={(e) => setUseLogs(e.target.checked)} /> Chain events
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={useQuick} onChange={(e) => setUseQuick(e.target.checked)} data-testid="use-quick" /> Quick check
          </label>
          <label className={`inline-flex items-center gap-2 ${explorerOn ? "" : "opacity-60"}`} title={explorerOn ? "" : "Not configured on this site yet"}>
            <input type="checkbox" checked={useExplorer && Boolean(explorerOn)} disabled={!explorerOn} onChange={(e) => setUseExplorer(e.target.checked)} /> Explorer history {explorerOn === false ? <span className="text-[12px] text-[var(--ink-55)]">(not configured on this site yet)</span> : null}
          </label>
        </div>
        {running || phase ? (
          <div className="nl-progress mt-5" data-testid="scan-progress">
            {progress ? (
              <>
                <div className="flex flex-wrap justify-between gap-2 text-[13px]">
                  <span>
                    {fmt(progress.covered)} of {fmt(progress.total)} blocks read · window {fmt(progress.chunk)} · {progress.queries} windows · {progress.events} new events
                  </span>
                  <span className="font-semibold text-[var(--olive)]">{progress.total ? ((progress.covered / progress.total) * 100).toFixed(progress.covered / progress.total < 0.1 ? 2 : 0) : 100}%</span>
                </div>
                <div className="nl-bar">
                  <i style={{ width: `${progress.total ? Math.min(100, (progress.covered / progress.total) * 100) : 100}%` }} />
                </div>
              </>
            ) : null}
            {phase ? <p className="nl-small m-0">{phase}</p> : null}
          </div>
        ) : null}
        {error ? <p className="nl-alert mt-4 mb-0">{error}</p> : null}
        {notes.length ? (
          <ul className="nl-note mt-4 mb-0 grid list-none gap-1" data-testid="scan-notes">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
        {scanned ? <CoverageView scanned={scanned} onForget={forgetProgress} /> : null}
      </div>

      {spenderFilter ? (
        <p className="nl-note m-0 flex flex-wrap items-center gap-2" data-testid="spender-filter">
          Showing one spender: <strong>{spenderName(spenderFilter) ?? "Not listed on this site"}</strong> <span className="nl-mono break-all">{spenderFilter}</span>
          <button type="button" className="nl-btn outline xs" onClick={() => setSpenderFilter(null)}>
            Show all spenders
          </button>
        </p>
      ) : null}

      {owner ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="scan-stats">
          <div className="nl-stat">
            <p className="k">Address</p>
            <p className="v !text-[16px]">
              <a href={explorerAddress(owner)} target="_blank" rel="noreferrer" className="nl-mono no-underline hover:underline">
                {shortAddress(owner, 6, 4)}
              </a>
            </p>
          </div>
          <div className="nl-stat">
            <p className="k">Open now</p>
            <p className="v" data-testid="open-count">
              {running && pairs.size === 0 ? "…" : openRows.length}
            </p>
          </div>
          <div className="nl-stat">
            <p className="k">Pairs found</p>
            <p className="v">{pairs.size}</p>
          </div>
          <div className="nl-stat">
            <p className="k">Events read</p>
            <p className="v">{events.length}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="nl-tabs" role="tablist" aria-label="Workspace">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}>
              {t.label}
              {t.id === "revoke" && queue.filter((q) => q.state !== "done").length ? <span className="n">{queue.filter((q) => q.state !== "done").length}</span> : null}
              {t.id === "dashboard" && openRows.length ? <span className="n">{openRows.length}</span> : null}
            </button>
          ))}
        </div>
        {tab === "dashboard" && rows.length > openRows.length ? (
          <label className="inline-flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show closed ({rows.length - openRows.length})
          </label>
        ) : null}
      </div>

      {tab === "dashboard" ? (
        <div className="nl-table-wrap" data-testid="dashboard">
          <table className="nl-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Kind</th>
                <th>Spender</th>
                <th>Amount now</th>
                <th>Last change</th>
                <th>Found by</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!owner ? (
                <tr>
                  <td colSpan={7} className="nl-empty">
                    Enter or connect an address, then press Scan permissions. Reading needs no wallet.
                  </td>
                </tr>
              ) : shown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="nl-empty" data-testid="dashboard-empty">
                    {running ? "Scanning…" : `No open permissions found in what was read. That is not proof there are none: see the notes above and the limits page.`}
                  </td>
                </tr>
              ) : (
                shown.map((r) => {
                  const p = r.pair;
                  const t = changedAt(p);
                  return (
                    <tr key={p.key} className={r.open ? "" : "closed"} data-testid="perm-row">
                      <td>
                        <a href={explorerAddress(p.token)} target="_blank" rel="noreferrer" className="font-bold no-underline hover:underline">
                          {tokenName(p.token)}
                        </a>
                        {p.kind === "nft-one" ? <span className="block text-[12px] text-[var(--ink-55)]">#{p.tokenId?.toString()}</span> : null}
                      </td>
                      <td>
                        <span className="nl-tag">{KIND_WORDS[p.kind]}</span>
                      </td>
                      <td>
                        <span className="block font-semibold">{spenderName(p.spender) ?? (labels?.get(p.spender.toLowerCase())?.labels ? `${labels.get(p.spender.toLowerCase())!.labels} label(s)` : "Unlabelled")}</span>
                        <AddressChip value={p.spender} />
                      </td>
                      <td className="font-bold whitespace-nowrap" data-testid="perm-amount">
                        {r.cur?.unreadable ? <span className="nl-tag watch">Unreadable</span> : amountOf(r)}
                      </td>
                      <td className="whitespace-nowrap">
                        {p.last ? (
                          <a href={explorerTx(p.last.tx)} target="_blank" rel="noreferrer" className="no-underline hover:underline">
                            {t ? new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : `block ${p.last.block.toLocaleString("en-US")}`}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-[12px] text-[var(--ink-70)]">{[...p.source].map((s) => SOURCE_WORDS[s] ?? s).join(", ")}</td>
                      <td className="whitespace-nowrap">
                        {r.open ? (
                          <button type="button" className="nl-btn outline xs" disabled={inQueue(p.key)} onClick={() => enqueue(p)} data-testid="enqueue">
                            {inQueue(p.key) ? "Queued" : "Add to revoke"}
                          </button>
                        ) : (
                          <span className="text-[12px] text-[var(--ink-55)]">Closed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "review" ? (
        <div className="grid gap-4" data-testid="review">
          {openRows.length === 0 ? <p className="nl-panel nl-empty m-0">Nothing open to review yet. Scan an address first.</p> : null}
          {[...new Set(openRows.map((r) => r.pair.spender.toLowerCase()))].map((sp) => {
            const group = openRows.filter((r) => r.pair.spender.toLowerCase() === sp);
            const f = facts4(group[0].pair.spender);
            const lf = labels?.get(sp);
            return (
              <div key={sp} className="nl-panel" data-testid="review-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="nl-kicker">Spender</p>
                    <p className="m-0 mt-1 text-[20px] font-bold">{f.knownName ?? "Not listed on this site"}</p>
                    <p className="nl-mono m-0 mt-1 text-[13px] break-all text-[var(--ink-70)]">{group[0].pair.spender}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/labels?spender=${group[0].pair.spender}`} className="nl-btn outline xs">
                      Labels {lf ? `(${lf.labels})` : ""}
                    </Link>
                    <a href={explorerAddress(group[0].pair.spender)} target="_blank" rel="noreferrer" className="nl-btn outline xs">
                      Explorer
                    </a>
                  </div>
                </div>
                <dl className="nl-kv mt-4">
                  <dt>Contract code</dt>
                  <dd>{f.hasCode === null ? "—" : f.hasCode ? "Yes" : "No, a plain wallet"}</dd>
                  <dt>Published source</dt>
                  <dd>{f.verified === null || f.verified === undefined ? (explorerOn ? "—" : "— (explorer source not configured)") : f.verified ? "Listed on the explorer" : "Not found on the explorer"}</dd>
                  <dt>Community</dt>
                  <dd>{lf ? `${lf.labels} label(s), ${lf.flags} flag(s)${labelsLive() ? "" : " in this browser (practice)"}` : "—"}</dd>
                </dl>
                <div className="mt-4 grid gap-3">
                  {group.map((r) => {
                    const hints = r.cur ? hintsFor(r.pair, r.cur, f, changedAt(r.pair), now) : [];
                    return (
                      <div key={r.pair.key} className="rounded-2xl border border-[var(--line-soft)] bg-white/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="m-0 font-bold">
                            {tokenName(r.pair.token)} · {KIND_WORDS[r.pair.kind]} · {amountOf(r)}
                          </p>
                          <button type="button" className="nl-btn outline xs" disabled={inQueue(r.pair.key)} onClick={() => enqueue(r.pair)}>
                            {inQueue(r.pair.key) ? "Queued" : "Add to revoke"}
                          </button>
                        </div>
                        {hints.length ? (
                          <ul className="m-0 mt-3 grid list-none gap-1.5 p-0">
                            {hints.map((h) => (
                              <li key={h.id} className="flex gap-2 text-[14px]" data-testid={`hint-${h.id}`}>
                                <span className={`nl-tag ${h.tone === "watch" ? "watch" : ""} shrink-0`}>{h.tone === "watch" ? "Look" : "Note"}</span>
                                <span>{h.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="nl-small m-0 mt-2">No hints from what was read. That is not a statement that this spender is fine.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === "revoke" ? (
        <RevokeQueue
          owner={owner}
          queue={queue}
          ownerIsMe={ownerIsMe}
          connected={Boolean(address)}
          batchSupport={batchSupport}
          onSignAll={async (items) => {
            if (!owner || items.length === 0) return;
            const ps = items.map(pairOf);
            const keys = new Set(items.map((i) => i.key));
            const mark = (fn: (x: QItem) => QItem) => updateQueue((q) => q.map((x) => (keys.has(x.key) ? fn(x) : x)));
            mark((x) => ({ ...x, state: "sending", note: undefined }));
            try {
              if (!onRobinhoodChain) await switchNetwork();
              const id = await sendBatch(ps.map((p) => revokeCall(p, PERMIT2)));
              mark((x) => ({ ...x, note: "Batch sent. Waiting for the chain…" }));
              const until = Date.now() + 180_000;
              let st = await batchStatus(id).catch(() => null);
              while ((!st || st.state === "pending") && Date.now() < until) {
                await new Promise((r) => setTimeout(r, 1500));
                st = await batchStatus(id).catch(() => null);
              }
              const cur = await readCurrent(owner, ps);
              setCurrent((m) => new Map([...m, ...cur]));
              const nowSec = Math.floor(Date.now() / 1000);
              const tx = st?.hashes[0];
              updateQueue((q) =>
                q.map((x) => {
                  if (!keys.has(x.key)) return x;
                  const stillOpen = isOpen(pairOf(x), cur.get(x.key), nowSec);
                  const okState = st?.state === "confirmed" && !stillOpen;
                  const note = !st || st.state === "pending" ? "No final status from the wallet yet; read again from the chain." : st.state === "failed" ? "The batch did not go through; nothing in it was applied." : stillOpen ? "Confirmed, but the permission still reads as open. Check the token." : "Closed in one batch, read again from the chain.";
                  return { ...x, state: okState ? "done" : "failed", tx: tx ?? x.tx, note };
                }),
              );
            } catch (e) {
              mark((x) => ({ ...x, state: "failed", note: explain(e) }));
            }
          }}
          tokenName={tokenName}
          spenderName={spenderName}
          onConnect={openWallet}
          onRemove={(k) => updateQueue((q) => q.filter((x) => x.key !== k))}
          onClearDone={() => updateQueue((q) => q.filter((x) => x.state !== "done"))}
          onSign={async (item) => {
            if (!owner) return;
            const p = pairOf(item);
            const call = revokeCall(p, PERMIT2);
            updateQueue((q) => q.map((x) => (x.key === item.key ? { ...x, state: "sending", note: undefined } : x)));
            try {
              if (!onRobinhoodChain) await switchNetwork();
              const hash = await sendTransaction({ to: call.to, data: call.data });
              updateQueue((q) => q.map((x) => (x.key === item.key ? { ...x, tx: hash, note: "Sent. Waiting for the chain…" } : x)));
              const rc = await waitForReceipt(hash);
              const cur = await readCurrent(owner, [p]);
              setCurrent((m) => new Map([...m, ...cur]));
              const stillOpen = isOpen(p, cur.get(p.key), Math.floor(Date.now() / 1000));
              updateQueue((q) =>
                q.map((x) =>
                  x.key === item.key
                    ? { ...x, state: rc.ok && !stillOpen ? "done" : "failed", note: rc.ok ? (stillOpen ? "Confirmed, but the permission still reads as open. Check the token." : `Closed in block ${rc.blockNumber}, read again from the chain.`) : "The transaction failed on chain; the token refused it." }
                    : x,
                ),
              );
            } catch (e) {
              updateQueue((q) => q.map((x) => (x.key === item.key ? { ...x, state: "failed", note: explain(e) } : x)));
            }
          }}
        />
      ) : null}

      {tab === "history" ? (
        <div className="nl-panel" data-testid="history">
          <p className="nl-kicker">Approval events found</p>
          <p className="nl-small mt-1">
            {scanned ? `Chain events in ${fmt(describeCoverage(scanned.ranges, scanned.lo, scanned.head).covered)} read blocks between ${fmt(scanned.lo)} and ${fmt(scanned.head)}` : "No event scan yet"}
            {explorerOn ? " plus explorer history when it answered" : ""}. Newest first; each opens on the explorer.
          </p>
          {events.length === 0 ? (
            <p className="nl-empty m-0">No approval events in what was read.</p>
          ) : (
            <ol className="nl-timeline mt-6">
              {events.slice(0, 200).map((e) => {
                const off = (e.kind === "erc20" || e.kind === "permit2") && e.amount === 0n ? true : e.kind === "nft-all" ? e.approved === false : e.kind === "nft-one" ? /^0x0+$/.test(e.spender.slice(2)) : false;
                const t = times.get(e.block);
                return (
                  <li key={`${e.tx}:${e.logIndex}`} className={off ? "off" : ""}>
                    <p className="m-0 text-[14px] font-bold">
                      {off ? "Closed" : "Granted"} · {tokenName(e.token)} · {KIND_WORDS[e.kind]}
                      {e.kind === "erc20" || e.kind === "permit2" ? ` · ${formatAmount(e.kind, e.amount, meta.get(e.token.toLowerCase())?.decimals ?? null)}` : ""}
                      {e.lockdown ? " · lockdown" : ""}
                    </p>
                    <p className="m-0 mt-1 text-[13px] text-[var(--ink-70)]">
                      Spender <span className="nl-mono">{shortAddress(e.spender, 6, 4)}</span> ·{" "}
                      <a href={explorerTx(e.tx)} target="_blank" rel="noreferrer" className="nl-link">
                        {t ? new Date(t * 1000).toLocaleString("en-GB") : `block ${e.block.toLocaleString("en-US")}`}
                      </a>
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ) : null}

      {tab === "check" ? (
        <PairCheck
          owner={owner ?? (isAddress(input) ? getAddress(input) : null)}
          onFound={async (p) => {
            const who = owner ?? getAddress(input);
            if (!owner) setOwner(who);
            setPairs((m) => mergePairs(m, new Map([[p.key, p]])));
            await enrich(who, [p], []);
            setPhase(null);
            setTab("dashboard");
          }}
        />
      ) : null}

      <p className="nl-small m-0">
        Reads go through this site&apos;s relay to {CHAIN.name}. Amounts are read from the token (or Permit2) at the latest block. Hints are facts, not verdicts.{" "}
        <Link href="/limits" className="nl-link">
          Limits
        </Link>
      </p>
    </div>
  );
}

function CoverageView({ scanned, onForget }: { scanned: { lo: number; head: number; ranges: Range[]; paused: boolean }; onForget: () => void }) {
  const d = describeCoverage(scanned.ranges, scanned.lo, scanned.head);
  const whole = describeCoverage(scanned.ranges, 1, scanned.head);
  return (
    <div className="mt-4 rounded-2xl border border-[var(--line-soft)] bg-white/70 p-4 text-[14px]" data-testid="coverage">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 font-bold">
          Event coverage: {d.percent.toFixed(d.percent < 10 ? 2 : 1)}% of the chosen window · {whole.percent.toFixed(whole.percent < 10 ? 3 : 1)}% of the whole chain
        </p>
        <button type="button" className="nl-btn outline xs" onClick={onForget}>
          Forget saved progress
        </button>
      </div>
      <div className="nl-bar mt-3" aria-hidden="true">
        <i style={{ width: `${Math.max(0.5, d.percent)}%` }} />
      </div>
      <p className="m-0 mt-3" data-testid="coverage-read">
        Read:{" "}
        {mergeRanges(scanned.ranges)
          .slice(-3)
          .reverse()
          .map(([a, b]) => `${fmt(a)}–${fmt(b)}`)
          .join(", ") || "nothing yet"}
        {scanned.ranges.length > 3 ? ` and ${scanned.ranges.length - 3} older ranges` : ""}.
      </p>
      <p className="m-0 mt-1 text-[var(--ink-70)]" data-testid="coverage-missing">
        Not read in this window:{" "}
        {d.missing.length
          ? `${d.missing
              .slice(0, 3)
              .map(([a, b]) => `${fmt(a)}–${fmt(b)}`)
              .join(", ")}${d.missing.length > 3 ? ` and ${d.missing.length - 3} more gaps` : ""} (${fmt(d.total - d.covered)} blocks). Approvals given there are found only by the known-spender check, the explorer history or a check by hand.`
          : "nothing, every block in it was read."}
      </p>
    </div>
  );
}

function RevokeQueue({
  owner,
  queue,
  ownerIsMe,
  connected,
  batchSupport,
  onSignAll,
  tokenName,
  spenderName,
  onConnect,
  onRemove,
  onClearDone,
  onSign,
}: {
  owner: string | null;
  queue: QItem[];
  ownerIsMe: boolean;
  connected: boolean;
  tokenName: (t: string) => string;
  spenderName: (s: string) => string | null;
  onConnect: () => void;
  onRemove: (k: string) => void;
  onClearDone: () => void;
  onSign: (q: QItem) => Promise<void>;
  batchSupport: () => Promise<BatchSupport>;
  onSignAll: (items: QItem[]) => Promise<void>;
}) {
  const busy = queue.some((q) => q.state === "sending");
  const done = queue.filter((q) => q.state === "done").length;
  const pending = queue.filter((q) => q.state === "queued" || q.state === "failed");
  const [asked, setAsked] = useState<BatchSupport | null>(null);
  useEffect(() => {
    if (!connected || !ownerIsMe) return;
    let cancelled = false;
    batchSupport().then((s) => {
      if (!cancelled) setAsked(s);
    });
    return () => {
      cancelled = true;
    };
  }, [connected, ownerIsMe, batchSupport]);
  const support = connected && ownerIsMe ? asked : null;
  return (
    <div className="grid gap-4" data-testid="revoke">
      <div className="nl-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="nl-kicker">Revoke queue{owner ? ` · ${shortAddress(owner, 6, 4)}` : ""}</p>
            <p className="m-0 mt-1 text-[24px] font-bold">
              {done} of {queue.length} closed
            </p>
          </div>
          {done ? (
            <button type="button" className="nl-btn outline xs" onClick={onClearDone}>
              Clear closed rows
            </button>
          ) : null}
        </div>
        <div className="nl-bar mt-4">
          <i style={{ width: `${queue.length ? (done / queue.length) * 100 : 0}%` }} />
        </div>
        <p className="nl-small mt-4 mb-0">
          One transaction per row, signed by your own wallet after you read the call below. Each row is read again from the chain once its transaction lands. Revoking stops future use of that permission; it cannot undo transfers that already happened.
        </p>
        {ownerIsMe && pending.length > 1 ? (
          support === "supported" || support === "ready" ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className="nl-btn md" disabled={busy} onClick={() => onSignAll(pending)} data-testid="sign-batch">
                Sign all {pending.length} in one batch
              </button>
              <span className="nl-small">Your wallet offers atomic batches (EIP-5792): the {pending.length} calls below run together or not at all, with one signature.</span>
            </div>
          ) : support === "none" ? (
            <p className="nl-small mt-4 mb-0" data-testid="batch-none">
              Your wallet does not offer atomic batches (EIP-5792), so each row is signed on its own.
            </p>
          ) : null
        ) : null}
        {!connected ? (
          <button type="button" className="nl-btn md mt-4" onClick={onConnect}>
            Connect the wallet that owns these permissions
          </button>
        ) : !ownerIsMe && owner ? (
          <p className="nl-note warn mt-4 mb-0">You are reading {shortAddress(owner, 6, 4)}, but a different wallet is connected. Only the owner of a permission can revoke it: connect that wallet, or scan your own address.</p>
        ) : null}
      </div>
      {queue.length === 0 ? <p className="nl-panel nl-empty m-0">The queue is empty. Use “Add to revoke” on the dashboard or in the review.</p> : null}
      {queue.map((q) => {
        const call = revokeCall(pairOf(q), PERMIT2);
        return (
          <div key={q.key} className="nl-panel" data-testid="queue-row">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 font-bold">
                  {tokenName(q.token)} · {KIND_WORDS[q.kind]}
                  {q.tokenId ? ` #${q.tokenId}` : ""}
                </p>
                <p className="m-0 mt-1 text-[13px] text-[var(--ink-70)]">
                  Spender {spenderName(q.spender) ?? ""} <span className="nl-mono">{q.spender}</span>
                </p>
              </div>
              <span className={`nl-tag ${q.state === "failed" ? "bad" : q.state === "done" ? "" : "sky"}`} data-testid="queue-state">
                {q.state === "queued" ? "Ready" : q.state === "sending" ? "In your wallet" : q.state === "done" ? "Closed" : "Not closed"}
              </span>
            </div>
            <dl className="nl-kv mt-4">
              <dt>Target</dt>
              <dd className="nl-mono">{call.to}</dd>
              <dt>Function</dt>
              <dd className="nl-mono">{call.fn}</dd>
              <dt>Arguments</dt>
              <dd className="nl-mono">{call.args.join(", ")}</dd>
              <dt>Value</dt>
              <dd className="nl-mono">0 ETH</dd>
            </dl>
            <pre className="nl-calldata" data-testid="calldata">
              {call.data}
            </pre>
            {q.note ? <p className={`mt-3 mb-0 text-[14px] ${q.state === "failed" ? "text-[var(--bad)]" : ""}`}>{q.note}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {q.state !== "done" ? (
                <button type="button" className="nl-btn sm" disabled={!ownerIsMe || busy} onClick={() => onSign(q)} data-testid="sign-revoke">
                  {q.state === "sending" ? "Check your wallet…" : q.state === "failed" ? "Try again" : "Sign this revoke"}
                </button>
              ) : null}
              {q.tx ? (
                <a href={explorerTx(q.tx)} target="_blank" rel="noreferrer" className="nl-btn outline sm">
                  Transaction
                </a>
              ) : null}
              {q.state !== "sending" ? (
                <button type="button" className="nl-btn outline sm" onClick={() => onRemove(q.key)}>
                  Remove from queue
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PairCheck({ owner, onFound }: { owner: string | null; onFound: (p: Pair) => Promise<void> }) {
  const [kind, setKind] = useState<Kind>("erc20");
  const [token, setToken] = useState("");
  const [spender, setSpender] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setMsg(null);
    if (!owner) return setMsg("Enter the wallet address at the top first.");
    if (!isAddress(token)) return setMsg("Token or collection must be a 0x address.");
    if (kind !== "nft-one" && !isAddress(spender)) return setMsg("Spender must be a 0x address.");
    if (kind === "nft-one" && !/^\d{1,78}$/.test(tokenId)) return setMsg("Token id must be a whole number.");
    setBusy(true);
    try {
      const p = barePair(kind, token, kind === "nft-one" ? (isAddress(spender) ? spender : "0x0000000000000000000000000000000000000000") : spender, "manual", kind === "nft-one" ? BigInt(tokenId) : null);
      const cur = await readCurrent(owner, [p]);
      const c = cur.get(p.key);
      if (!c || c.unreadable) {
        setMsg("The token did not answer that read. It may not be this kind of token.");
        return;
      }
      if (kind === "nft-one" && c.approvedNow) p.spender = getAddress(c.approvedNow);
      const openNow = kind === "nft-one" ? Boolean(c.approvedNow && !/^0x0+$/.test(c.approvedNow.slice(2))) : (c.amount ?? 0n) > 0n;
      if (!openNow) {
        setMsg("Nothing open for that pair right now.");
        return;
      }
      await onFound(p);
    } catch (e) {
      setMsg(explain(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="nl-panel" data-testid="pair-check">
      <p className="nl-kicker">Check one pair by hand</p>
      <p className="nl-small mt-1">For an approval older than the event window. The state is read from the token right now.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="nl-field">
          <span>Kind</span>
          <select className="nl-input" value={kind} onChange={(e) => setKind(e.target.value as Kind)} data-testid="check-kind">
            {(Object.keys(KIND_WORDS) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_WORDS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="nl-field">
          <span>{kind === "erc20" || kind === "permit2" ? "Token" : "Collection"}</span>
          <input className="nl-input mono" value={token} onChange={(e) => setToken(e.target.value.trim())} placeholder="0x…" data-testid="check-token" />
        </label>
        {kind === "nft-one" ? (
          <label className="nl-field">
            <span>Token id</span>
            <input className="nl-input mono" value={tokenId} onChange={(e) => setTokenId(e.target.value.trim())} placeholder="1234" />
          </label>
        ) : (
          <label className="nl-field">
            <span>{kind === "nft-all" ? "Operator" : "Spender"}</span>
            <input className="nl-input mono" value={spender} onChange={(e) => setSpender(e.target.value.trim())} placeholder="0x…" data-testid="check-spender" />
          </label>
        )}
      </div>
      <button type="button" className="nl-btn md mt-4" disabled={busy} onClick={run} data-testid="check-go">
        {busy ? "Reading…" : "Read this pair"}
      </button>
      {msg ? <p className="nl-note mt-4 mb-0" data-testid="check-msg">{msg}</p> : null}
    </div>
  );
}
