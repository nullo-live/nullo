/** "One wallet, three spenders" diagram (the reference's balance tree slot). Example values, labelled. */
export function TreeCard() {
  const rows = [
    { dot: "linear-gradient(135deg,#becd67,#697733)", v: "Unlimited", t: "Router" },
    { dot: "#8fc1d9", v: "All items", t: "Marketplace" },
    { dot: "#697733", v: "1,000", t: "Permit2" },
  ];
  return (
    <div className="relative" data-testid="tree-card">
      <div className="nl-glass-glow" aria-hidden="true" />
      <div className="nl-glass p-6 sm:p-8">
        <div className="mx-auto w-fit rounded-2xl bg-[#1d3814] px-6 py-4 text-center text-white">
          <p className="m-0 text-[11px] font-semibold tracking-[0.1em] text-white/60 uppercase">Example wallet</p>
          <p className="m-0 mt-1 text-[22px] font-bold tracking-tight">3 open permissions</p>
        </div>
        <svg viewBox="0 0 400 60" className="mx-auto block h-[60px] w-full max-w-[420px]" aria-hidden="true">
          <path d="M200 0 V20 M200 20 H67 V60 M200 20 V60 M200 20 H333 V60" fill="none" stroke="rgba(29,56,20,0.35)" strokeWidth="1.5" />
        </svg>
        <div className="grid grid-cols-3 gap-3">
          {rows.map((r) => (
            <div key={r.t} className="rounded-2xl border border-[var(--line)] bg-white/80 px-2 py-4 text-center">
              <span className="mx-auto block h-5 w-5 rounded-full" style={{ background: r.dot }} />
              <p className="m-0 mt-3 text-[18px] font-bold tracking-tight sm:text-[20px]">{r.v}</p>
              <span className="nl-tag mt-2">{r.t}</span>
            </div>
          ))}
        </div>
        <p className="m-0 mt-5 text-center text-[13px] text-[var(--ink-55)]">Example: one wallet, three spenders, each with its own permission</p>
      </div>
    </div>
  );
}
