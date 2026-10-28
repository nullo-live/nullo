"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/config/brand";
import { storageKey } from "@/config/storage";
import { Brand } from "@/components/site/Brand";
import { CaPill } from "@/components/site/CaCopy";
import { CloseIcon, MenuIcon } from "@/components/site/Icons";
import { TOP_NAV } from "@/components/site/nav";
import { NavWallet } from "@/components/wallet/WalletButton";
import { useLocalStore } from "@/components/wallet/useLocalStore";

const BANNER_KEY = storageKey("banner", "v1");

/** Top banner + floating pill bar. The bar slides away while scrolling down and comes back on the way up. */
export function SiteHeader() {
  const path = usePathname() ?? "/";
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [bannerState, setBannerState] = useLocalStore<string>(BANNER_KEY, "open");
  const banner = bannerState !== "closed";
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  const open = openOn === path;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 160 && y > last.current + 4);
      if (y < last.current - 4 || y < 160) setHidden(false);
      last.current = y;
    };
    window.addEventListener("keydown", esc);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  const isOn = (href: string) => !href.includes("#") && (path === href || path.startsWith(`${href}/`));
  const closeBanner = () => setBannerState("closed");

  return (
    <>
      <a href="#main" className="nl-skip">
        Skip to content
      </a>
      {banner ? (
        <div className="nl-banner" data-testid="banner">
          <Link href="/app">Scan your wallet on {BRAND.chainName} · Open the app →</Link>
          <button type="button" aria-label="Close the banner" onClick={closeBanner}>
            <CloseIcon size={16} />
          </button>
        </div>
      ) : null}
      <header className={`nl-header${banner ? "" : " nobanner"}${hidden && !open ? " hide" : ""}`} data-testid="header">
        <div className="nl-nav-shell">
          <Brand />
          <nav className="nl-nav" aria-label="Main">
            {TOP_NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={isOn(n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="nl-head-actions">
            <span className="nl-hide-sm">
              <CaPill />
            </span>
            <span className="min-w-0">
              <NavWallet label="Connect" className="nl-btn outline nl-btn-head" />
            </span>
            <Link href="/app" className="nl-btn nl-btn-head nl-hide-xs" data-testid="open-app">
              Open App
            </Link>
            <button type="button" className="nl-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpenOn(open ? null : path)} data-testid="burger">
              {open ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
            </button>
          </div>
        </div>
        <nav className={`nl-drawer${open ? " open" : ""}`} aria-label="Menu" data-testid="drawer">
          <p className="nl-kicker m-0 mb-1">Navigate</p>
          {[{ href: "/app", label: "Open the app" }, ...TOP_NAV, { href: "/token", label: `${BRAND.symbol} token` }].map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpenOn(null)}>
              {n.label}
            </Link>
          ))}
          <div className="mt-4 flex flex-wrap gap-3">
            <CaPill />
          </div>
        </nav>
      </header>
    </>
  );
}
