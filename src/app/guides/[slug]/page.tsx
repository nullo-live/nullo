import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@/config/brand";
import { GUIDES, guideBySlug } from "@/content/guides";
import { JsonLd } from "@/components/JsonLd";
import { ArrowLeft, ChevronRight } from "@/components/site/Icons";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  return pageMeta({ path: `/guides/${g.slug}`, title: `${g.title} ${g.tail.replace(/\.$/, "")} | ${BRAND.name}`, description: g.summary, type: "article" });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const next = GUIDES.find((x) => x.slug !== g.slug && x.no === g.no - 1) ?? GUIDES.find((x) => x.slug !== g.slug)!;
  return (
    <main id="main">
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Guides", path: "/guides" },
            { name: g.title, path: `/guides/${g.slug}` },
          ]),
          { "@context": "https://schema.org", "@type": "Article", headline: `${g.title} ${g.tail}`, description: g.summary, datePublished: "2026-10-30", author: { "@type": "Organization", name: `${BRAND.name} Team` }, publisher: { "@id": `${BRAND.url}/#org` } },
        ]}
      />
      <section className="nl-page-hero">
        <div className="nl-wash" aria-hidden="true" />
        <div className="nl-grid-lines" aria-hidden="true" />
        <div className="nl-container relative max-w-[800px]">
          <h1 className="nl-page-title nl-reveal !text-[clamp(44px,6vw,80px)]">
            {g.title}
            <span>{g.tail}</span>
          </h1>
          <p className="nl-lead nl-reveal">{g.summary}</p>
          <p className="nl-meta nl-reveal mt-8 border-y border-[var(--line-soft)] py-5 !text-[14px]">
            <b className="!text-[var(--ink)]">The {BRAND.name} Team</b> • <span>{g.date}</span> • <span>~{g.minutes} min read</span>
          </p>
        </div>
      </section>
      <article className="nl-page !pt-10">
        <div className="nl-prose">
          <p className="nl-tldr nl-reveal !mt-6">
            <b>TL;DR</b>
            {g.tldr}
          </p>
          {g.sections.map((s) => (
            <section key={s.h} className="nl-reveal">
              <h2>{s.h}</h2>
              {s.p.map((p) => (
                <p key={p.slice(0, 32)}>{p}</p>
              ))}
            </section>
          ))}
          <div className="nl-card nl-reveal mt-16 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="nl-kicker">Try it on your own address</p>
              <p className="m-0 mt-1 text-[18px] font-bold">Read your open permissions in a minute.</p>
            </div>
            <Link href="/app" className="nl-btn md">
              Open the app <ChevronRight size={16} className="go" />
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap justify-between gap-4">
            <Link href="/guides" className="nl-arrow-link">
              <ArrowLeft size={14} /> All guides
            </Link>
            <Link href={`/guides/${next.slug}`} className="nl-arrow-link">
              Next: {next.title} {next.tail} <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}
