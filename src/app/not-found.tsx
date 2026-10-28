import Link from "next/link";
import { PageHero } from "@/components/site/PageHero";

export default function NotFound() {
  return (
    <main id="main">
      <PageHero title="Nothing here," tail="not even an approval." lead="The page you asked for does not exist. The scanner or the guides may have what you were looking for.">
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/app" className="nl-btn">
            Open the app
          </Link>
          <Link href="/" className="nl-btn outline">
            Home
          </Link>
        </div>
      </PageHero>
    </main>
  );
}
