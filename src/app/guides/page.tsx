import Link from "next/link";
import { BRAND } from "@/config/brand";
import { GUIDES } from "@/content/guides";
import { PageHero } from "@/components/site/PageHero";
import { ArrowRight } from "@/components/site/Icons";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/guides",
  title: `Guides | ${BRAND.name}`,
  description: `Plain guides on token approvals, unlimited allowances, NFT operators and reading call data before you sign, from the ${BRAND.name} team.`,
});

export default function GuidesPage() {
  const [featured, ...more] = GUIDES;
  return (
    <main id="main">
      <PageHero title={`The ${BRAND.name}`} tail="Guides." lead="Short, plain notes on what wallet permissions are, how they stay open, and how to read a transaction before you sign it." />
      <section className="nl-page !pt-16">
        <div className="nl-container">
          <p className="nl-rule nl-reveal m-0">Featured</p>
          <Link href={`/guides/${featured.slug}`} className="nl-feature nl-reveal mt-8">
            <div className="p-8 sm:p-14">
              <span className="nl-tag">{featured.topic}</span>
              <h2 className="m-0 mt-6 text-[30px] leading-[1.15] font-bold tracking-tight sm:text-[36px]">
                {featured.title} {featured.tail}
              </h2>
              <p className="m-0 mt-5 text-[18px] leading-[29px] text-[var(--ink-70)]">{featured.summary}</p>
              <p className="nl-meta mt-6">
                <b>The {BRAND.name} Team</b> • <span>{featured.date}</span> • <span>~{featured.minutes} min read</span>
              </p>
              <span className="nl-arrow-link mt-6">
                Open the full guide <ArrowRight size={14} />
              </span>
            </div>
            <img src={featured.cover} alt="" width={960} height={720} className="h-full min-h-[260px] w-full object-cover" />
          </Link>
          <p className="nl-rule nl-reveal m-0 mt-20">More guides</p>
          <div className="nl-cards3 mt-8">
            {more.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className="nl-card nl-reveal !overflow-hidden !p-0">
                <img src={g.cover} alt="" width={960} height={720} className="block aspect-[4/3] w-full object-cover" />
                <div className="p-7">
                  <span className="nl-tag">{g.topic}</span>
                  <h3 className="m-0 mt-4 text-[20px] leading-[27px] font-bold tracking-tight">
                    {g.title} {g.tail}
                  </h3>
                  <p className="m-0 mt-3 text-[14px] leading-[22.75px] text-[var(--ink-70)]">{g.summary}</p>
                  <p className="nl-meta mt-5 !text-[12px]">
                    <span>{g.date}</span> • <span>~{g.minutes} min read</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
