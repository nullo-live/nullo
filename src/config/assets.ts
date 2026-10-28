/*
 * Every brand image path in one place. All of them are drawn from code by referensi/tools/make-brand.mjs (owner:
 * "AI-made for now, I will update"). To use the owner's artwork later, replace a file under public/brand or src/app and
 * keep its name, or change the path here.
 */
export const ASSETS = {
  /** Mark: hexagon tile with an empty-set ring, transparent. 256x256 (header, footer, wallet, cards). */
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
