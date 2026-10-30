/*
 * Every brand image path in one place. The mark, avatar, banner, icon, favicon and share card come from the owner's
 * artwork (30 Oct 2026) via 2026/oktober/30/assets/apply-owner-assets.mjs; the guide covers are still drawn by
 * referensi/tools/make-brand.mjs. Replace a file under public/brand or src/app and keep its name, or change the path here.
 */
export const ASSETS = {
  /** Mark: the owner's olive n, transparent. 256x256 (header, footer, wallet, cards). */
  mark: "/brand/mark.webp",
  /** Larger mark (token page). 512x512. */
  markLarge: "/brand/mark-512.webp",
  /** Square avatar / profile picture on the wash colour. 512x512. */
  avatar: "/brand/avatar.webp",
  /** Banner (mark + word + slogan). 1500x500. */
  banner: "/brand/banner.webp",
  /** Guide covers (olive tiles with one glyph each). 960x720. */
  guides: {
    allowance: "/brand/guide-allowance.webp",
    unlimited: "/brand/guide-unlimited.webp",
    operator: "/brand/guide-operator.webp",
    calldata: "/brand/guide-calldata.webp",
  },
  /** Square PNG served by Next from src/app/icon.png (structured data needs a PNG logo). */
  icon: "/icon.png",
  logoPng: "/icon.png",
  /** Share card served from src/app/opengraph-image.jpg; twitter-image.jpg is the same image. */
  og: "/opengraph-image.jpg",
} as const;
