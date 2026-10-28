import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";
import { GUIDES } from "@/content/guides";

// Every indexable page.
export const ROUTES = ["", "/app", "/labels", "/guides", ...GUIDES.map((g) => `/guides/${g.slug}`), "/glossary", "/contract", "/limits", "/privacy", "/token"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({ url: `${BRAND.url}${r}`, lastModified: now, changeFrequency: r === "" ? "daily" : "weekly", priority: r === "" ? 1 : 0.6 }));
}
