import Link from "next/link";
import { ASSETS } from "@/config/assets";
import { BRAND } from "@/config/brand";

/** Wordmark: the mark and the name in lower case, as the reference sets its own. */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`nl-wordmark ${className}`} aria-label={`${BRAND.name} home`}>
      <img src={ASSETS.mark} alt="" width={36} height={36} />
      <span>{BRAND.name.toLowerCase()}</span>
    </Link>
  );
}
