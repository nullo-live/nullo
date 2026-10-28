import { decodeEventLog, encodeFunctionData, getAddress, keccak256, toBytes, toEventSelector, type Abi } from "viem";
import { CONTRACTS, labelsLive } from "@/config/contracts";
import { storageKey } from "@/config/storage";
import { LABELS_ABI } from "@/lib/abi";
import { padTopic } from "@/lib/approvals";
import { read, rpcCall } from "@/lib/client";

/*
 * Community labels: reads and writes for NulloSpenderLabels, and a practice store with the same rules for the time
 * before the contract is deployed (each write is signed with personal_sign and kept in this browser; nothing is sent).
 */

export type LabelRow = { author: string; category: number; updatedAt: number; chainBlock: number; urlHash: string; name: string; url?: string | null };
export type SpenderView = { labels: LabelRow[]; count: number; flags: number; byReason: number[]; byCategory: number[]; myFlag: number };

/** Same rule as the contract: 1..32 printable ASCII, no space at either end. */
export function checkName(name: string): string | null {
  if (name.length < 1 || name.length > 32) return "1 to 32 characters.";
  if (name[0] === " " || name[name.length - 1] === " ") return "No space at the start or end.";
  if (!/^[\x20-\x7e]+$/.test(name)) return "Plain characters only (letters, digits, punctuation).";
  return null;
}

/** Same rule as the contract: empty, or https:// + 1..120 visible characters with no spaces. */
export function checkUrl(url: string): string | null {
  if (url === "") return null;
  if (url.length > 128 || url.length < 9 || !url.startsWith("https://")) return "Use an https:// link of at most 128 characters, or leave it empty.";
  if (!/^[\x21-\x7e]+$/.test(url.slice(8))) return "No spaces or special characters in the link.";
  return null;
}

export const urlHash = (url: string) => (url === "" ? `0x${"0".repeat(64)}` : keccak256(toBytes(url)));

// ------------------------------------------------------------------ practice store

const KEY = storageKey("labels-practice");
type PStore = { labels: Record<string, LabelRow[]>; flags: Record<string, Record<string, number>>; order: string[]; sigs: string[] };
const empty = (): PStore => ({ labels: {}, flags: {}, order: [], sigs: [] });

export function practiceLoad(): PStore {
  try {
    const raw = window.localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as PStore) : empty();
    return v && v.labels && v.flags && Array.isArray(v.order) ? { ...empty(), ...v } : empty();
  } catch {
    return empty();
  }
}

function practiceSave(s: PStore) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage full or blocked: the practice write is lost, nothing else breaks
  }
}

const remember = (s: PStore, spender: string) => {
  if (!s.order.includes(spender)) s.order.push(spender);
};

/** Applies one practice write with the contract's rules; returns an error text or null. */
export function practiceApply(
  s: PStore,
  op: { kind: "label"; spender: string; author: string; name: string; category: number; url: string } | { kind: "remove" | "unflag"; spender: string; author: string } | { kind: "flag"; spender: string; author: string; reason: number },
): string | null {
  const sp = op.spender.toLowerCase();
  const me = op.author.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(sp)) return "Enter the spender's address.";
  if (op.kind === "label") {
    const e = checkName(op.name) ?? checkUrl(op.url);
    if (e) return e;
    if (op.category < 1 || op.category > 8) return "Pick one of the listed categories.";
    const list = (s.labels[sp] ??= []);
    const row: LabelRow = { author: me, category: op.category, updatedAt: Math.floor(Date.now() / 1000), chainBlock: 0, urlHash: urlHash(op.url), name: op.name, url: op.url || null };
    const i = list.findIndex((l) => l.author === me);
    if (i >= 0) list[i] = row;
    else list.push(row);
    remember(s, sp);
    return null;
  }
  if (op.kind === "remove") {
    const list = s.labels[sp] ?? [];
    const i = list.findIndex((l) => l.author === me);
    if (i < 0) return "This wallet has no label on that spender to remove.";
    list[i] = list[list.length - 1];
    list.pop();
    return null;
  }
  if (op.kind === "flag") {
    if (sp === me) return "A wallet cannot flag its own address.";
    if (op.reason < 1 || op.reason > 6) return "Pick one of the listed reasons.";
    const f = (s.flags[sp] ??= {});
    if (f[me]) return "This wallet already flagged that spender. Take the flag back first to change the reason.";
    f[me] = op.reason;
    remember(s, sp);
    return null;
  }
  const f = s.flags[sp] ?? {};
  if (!f[me]) return "This wallet has not flagged that spender.";
  delete f[me];
  return null;
}

function practiceView(s: PStore, spender: string, me: string | null): SpenderView {
  const sp = spender.toLowerCase();
  const labels = s.labels[sp] ?? [];
  const flags = s.flags[sp] ?? {};
  const byReason = [0, 0, 0, 0, 0, 0, 0];
  for (const r of Object.values(flags)) byReason[r] += 1;
  const byCategory = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const l of labels) byCategory[l.category] += 1;
  return { labels, count: labels.length, flags: Object.keys(flags).length, byReason, byCategory, myFlag: me ? (flags[me.toLowerCase()] ?? 0) : 0 };
}

// ------------------------------------------------------------------ reads

const LABELED_TOPIC = toEventSelector("Labeled(address,address,string,uint8,string,bytes32,bool,uint64)");
const lab = () => CONTRACTS.labels;

/** Labels, counts and the caller's own flag for one spender (live contract or practice store). */
export async function spenderView(spender: string, me: string | null): Promise<SpenderView & { practice: boolean }> {
  if (!labelsLive()) return { ...practiceView(practiceLoad(), spender, me), practice: true };
  const [labels, counts, myFlag] = await Promise.all([
    read<readonly LabelRow[]>({ to: lab(), abi: LABELS_ABI as Abi, fn: "labelsOf", args: [spender, 0n, 100n] }),
    read<readonly [number, number, readonly number[], readonly number[]]>({ to: lab(), abi: LABELS_ABI as Abi, fn: "countsOf", args: [spender] }),
    me ? read<number>({ to: lab(), abi: LABELS_ABI as Abi, fn: "flagOf", args: [spender, me] }) : Promise.resolve(0),
  ]);
  return {
    labels: labels.map((l) => ({ author: getAddress(l.author), category: Number(l.category), updatedAt: Number(l.updatedAt), chainBlock: Number(l.chainBlock), urlHash: l.urlHash, name: l.name })),
    count: Number(counts[0]),
    flags: Number(counts[1]),
    byCategory: counts[2].map(Number),
    byReason: counts[3].map(Number),
    myFlag: Number(myFlag),
    practice: false,
  };
}

/** Link texts from recent Labeled events of `spender` (newest windows first, a few windows at most). */
export async function recentUrls(spender: string, windows = 4): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!labelsLive()) return out;
  const head = Number(BigInt(await rpcCall<string>("eth_blockNumber", [])));
  let to = head;
  for (let i = 0; i < windows && to >= CONTRACTS.labelsBlock; i++) {
    const from = Math.max(CONTRACTS.labelsBlock, to - 19_999);
    const logs = await rpcCall<{ topics: string[]; data: string }[]>("eth_getLogs", [{ address: lab(), fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}`, topics: [LABELED_TOPIC, padTopic(spender)] }]).catch(() => []);
    for (const l of logs) {
      try {
        const d = decodeEventLog({ abi: LABELS_ABI, data: l.data as `0x${string}`, topics: l.topics as [`0x${string}`] });
        const a = d.args as { author: string; url: string };
        const k = a.author.toLowerCase();
        if (!out.has(k)) out.set(k, a.url);
      } catch {
        // not a Labeled event
      }
    }
    to = from - 1;
  }
  return out;
}

export type SpenderSummary = { spender: string; labels: number; flags: number; topName: string | null };

/** The most recently first-seen spenders with their counts (live: last 50 from the contract; practice: this browser). */
export async function recentSpenders(): Promise<{ rows: SpenderSummary[]; total: number; practice: boolean }> {
  if (!labelsLive()) {
    const s = practiceLoad();
    const rows = [...s.order].reverse().map((sp) => {
      const v = practiceView(s, sp, null);
      return { spender: getAddress(sp), labels: v.count, flags: v.flags, topName: v.labels[0]?.name ?? null };
    });
    return { rows, total: rows.length, practice: true };
  }
  const total = Number(await read<bigint>({ to: lab(), abi: LABELS_ABI as Abi, fn: "spenderCount" }));
  const start = Math.max(0, total - 50);
  const list = total ? await read<readonly string[]>({ to: lab(), abi: LABELS_ABI as Abi, fn: "spendersFrom", args: [BigInt(start), 50n] }) : [];
  const views = await Promise.all(list.map((sp) => spenderView(sp, null).catch(() => null)));
  const rows = list
    .map((sp, i) => ({ spender: getAddress(sp), labels: views[i]?.count ?? 0, flags: views[i]?.flags ?? 0, topName: views[i]?.labels[0]?.name ?? null }))
    .reverse();
  return { rows, total, practice: false };
}

// ------------------------------------------------------------------ writes

export type Writer = { address: string; sendTransaction: (tx: { to?: string; data: string }) => Promise<string>; signMessage: (m: string) => Promise<string> };

export type LabelOp = { kind: "label"; spender: string; name: string; category: number; url: string } | { kind: "remove" | "unflag"; spender: string } | { kind: "flag"; spender: string; reason: number };

/** Call data for one write on the live contract. */
export function labelCall(op: LabelOp): string {
  const s = op.spender as `0x${string}`;
  switch (op.kind) {
    case "label":
      return encodeFunctionData({ abi: LABELS_ABI, functionName: "setLabel", args: [s, op.name, op.category, op.url] });
    case "remove":
      return encodeFunctionData({ abi: LABELS_ABI, functionName: "removeLabel", args: [s] });
    case "flag":
      return encodeFunctionData({ abi: LABELS_ABI, functionName: "flag", args: [s, op.reason] });
    case "unflag":
      return encodeFunctionData({ abi: LABELS_ABI, functionName: "unflag", args: [s] });
  }
}

/** Live: sends the transaction and returns its hash. Practice: signs a message, applies the rules, returns null. */
export async function writeLabel(op: LabelOp, w: Writer): Promise<{ hash: string | null }> {
  if (labelsLive()) return { hash: await w.sendTransaction({ to: lab(), data: labelCall(op) }) };
  const s = practiceLoad();
  const trial = JSON.parse(JSON.stringify(s)) as PStore;
  const err = practiceApply(trial, { ...op, author: w.address } as never);
  if (err) throw new Error(err);
  const sig = await w.signMessage(`Nullo practice label (nothing is sent)\n${op.kind} ${op.spender}\n${JSON.stringify(op)}\n${new Date().toISOString()}`);
  practiceApply(s, { ...op, author: w.address } as never);
  s.sigs = [...s.sigs.slice(-99), sig];
  practiceSave(s);
  return { hash: null };
}
