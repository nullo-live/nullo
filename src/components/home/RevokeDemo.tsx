import { CheckIcon } from "@/components/site/Icons";

/** Two demo cards under the revoke steps (the reference's request + offers slot). Example values. */
export function RevokeDemo() {
  const calls = [
    { t: "approve(spender, 0)", s: "Token allowance", done: true },
    { t: "setApprovalForAll(operator, false)", s: "Collection operator", done: true },
    { t: "approve(token, spender, 0, 0)", s: "Permit2 allowance", done: false },
  ];
  return (
    <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2 [&>*]:min-w-0" data-testid="revoke-demo">
      <div className="nl-card">
        <p className="nl-label m-0">Revoke queue</p>
        <p className="m-0 mt-2 text-[28px] font-bold tracking-tight sm:text-[36px]">2 of 3 closed</p>
        <div className="mt-6 flex justify-between text-[13px] font-semibold">
          <span>Signed and read again</span>
          <span className="text-[var(--olive)]">67%</span>
        </div>
        <div className="nl-bar mt-2 !h-[14px]">
          <i style={{ width: "67%" }} />
        </div>
        <p className="m-0 mt-5 text-[14px] leading-[22.75px] text-[var(--ink-70)]">
          <b className="text-[var(--ink)]">One at a time, or one batch.</b> Each row opens your wallet only when you press it; a wallet with atomic batches can sign the whole queue at once. Every row is read from the chain again afterwards.
        </p>
      </div>
      <div className="nl-card">
        <p className="nl-label m-0">Call data, shown first</p>
        <div className="mt-4 grid grid-cols-1 gap-2 [&>*]:min-w-0">
          {calls.map((c) => (
            <div key={c.t} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${c.done ? "border-[var(--line)] bg-[rgba(190,205,103,0.12)]" : "border-[var(--line-soft)] bg-white/70 opacity-70"}`}>
              <span className={`h-3 w-3 shrink-0 rounded-full ${c.done ? "bg-[var(--olive)]" : "bg-[var(--sky)]"}`} />
              <span className="min-w-0 flex-1">
                <span className="nl-mono block truncate text-[13px] font-semibold">{c.t}</span>
                <span className="block text-[12px] text-[var(--ink-55)]">{c.s}</span>
              </span>
              {c.done ? (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--olive)] text-white">
                  <CheckIcon size={14} />
                </span>
              ) : (
                <span className="text-[12px] text-[var(--ink-55)]">next</span>
              )}
            </div>
          ))}
        </div>
        <p className="m-0 mt-4 text-[14px] leading-[22.75px] text-[var(--ink-70)]">
          <b className="text-[var(--ink)]">Nothing hidden.</b> Target, function, arguments and raw bytes are printed before your wallet opens. Check them against your wallet&apos;s own screen.
        </p>
      </div>
    </div>
  );
}
