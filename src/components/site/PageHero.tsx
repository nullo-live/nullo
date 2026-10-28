/** Inner-page hero (the reference's blog / glossary header): wash, grid lines, two-tone title, lead. */
export function PageHero({ title, tail, lead, children, narrow = false }: { title: string; tail?: string; lead?: React.ReactNode; children?: React.ReactNode; narrow?: boolean }) {
  return (
    <section className="nl-page-hero">
      <div className="nl-wash" aria-hidden="true" />
      <div className="nl-grid-lines" aria-hidden="true" />
      <div className="nl-orb b" aria-hidden="true" />
      <div className={`nl-container relative ${narrow ? "max-w-[800px]" : ""}`}>
        <h1 className="nl-page-title nl-reveal">
          {title}
          {tail ? <span>{tail}</span> : null}
        </h1>
        {lead ? <p className="nl-lead nl-reveal max-w-[730px]">{lead}</p> : null}
        {children}
      </div>
    </section>
  );
}
