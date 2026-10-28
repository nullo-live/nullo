/** Long-form page (the reference's risks / security layout): narrow column, title, lead, dated, sections. */
export function ProsePage({ title, lead, updated, sections, children }: { title: string; lead: string; updated: string; sections: { h: string; p: string[] }[]; children?: React.ReactNode }) {
  return (
    <main id="main">
      <section className="nl-page-hero !pb-6">
        <div className="nl-wash" aria-hidden="true" />
        <div className="nl-container relative">
          <div className="nl-prose">
            <h1 className="nl-page-title nl-reveal !text-[48px]">{title}</h1>
            <p className="nl-lead nl-reveal !text-[21px] !leading-[33px]">{lead}</p>
            <p className="m-0 mt-6 text-[13px] text-[var(--ink-55)]">Last updated {updated}</p>
          </div>
        </div>
      </section>
      <section className="nl-page !pt-4">
        <div className="nl-prose">
          {sections.map((s) => (
            <section key={s.h} className="nl-reveal">
              <h2>{s.h}</h2>
              {s.p.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </section>
          ))}
          {children}
        </div>
      </section>
    </main>
  );
}
