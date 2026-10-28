/** Site navigation (floating bar, drawer, footer). One list each, so every place stays in step. */

export const TOP_NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#revoke", label: "Revoke" },
  { href: "/labels", label: "Labels" },
  { href: "/#faq", label: "FAQ" },
  { href: "/guides", label: "Guides" },
] as const;

export const FOOTER_COLUMNS = [
  {
    title: "Quick Links",
    links: [
      { href: "/app", label: "Open the app" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/labels", label: "Community labels" },
      { href: "/#faq", label: "FAQ" },
      { href: "/guides", label: "Guides" },
      { href: "/glossary", label: "Glossary" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/contract", label: "The labels contract" },
      { href: "/limits", label: "Limits" },
      { href: "/privacy", label: "Privacy" },
      { href: "/token", label: "Token" },
    ],
  },
] as const;
