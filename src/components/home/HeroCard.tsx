/** Hero example card (the reference's "example request" slot): one permission as the dashboard shows it. Example values. */
export function HeroCard() {
  return (
    <div className="relative" data-testid="hero-card">
      <div className="nl-glass-glow" aria-hidden="true" />
      <div className="nl-glass p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-[18px] font-bold tracking-tight">Example permission</p>
          <span className="nl-tag sky">Example</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="nl-mini">
            <p className="k">Token</p>
            <p className="v">USDG</p>
            <p className="s">Token allowance, read from the token now</p>
          </div>
          <div className="nl-mini">
            <p className="k">Amount</p>
            <p className="v">Unlimited</p>
            <p className="s">Any balance, now or later. The spender decides when.</p>
          </div>
        </div>
        <div className="nl-mini mt-4">
          <div className="flex items-center justify-between">
            <p className="k">Review hints</p>
            <p className="k !text-[var(--ink-70)]">3 of 8</p>
          </div>
          <div className="nl-bar mt-3">
            <i style={{ width: "38%" }} />
          </div>
          <div className="mt-2 flex justify-between text-[12px] text-[var(--ink-70)]">
            <span>Quiet</span>
            <span>Look closer</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="nl-mini">
            <p className="k">Spender</p>
            <p className="v sm nl-mono">0x8876…0904</p>
          </div>
          <div className="nl-mini">
            <p className="k">Last change</p>
            <p className="v sm">214 days</p>
          </div>
          <div className="nl-mini">
            <p className="k">To close</p>
            <p className="v sm">1 transaction</p>
          </div>
        </div>
      </div>
    </div>
  );
}
