import type { SeoContext, SeoMetadata, SeoPolicy } from "./types";

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;
const DEFAULT_SITE_NAME = "Phoenix";
const DEFAULT_IMAGE = "/og/default.png";
const DESCRIPTION_FALLBACK = "Discover verified information about this Phoenix entity.";

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
function limit(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1).trimEnd() + "…" : value;
}
function languageOf(locale: string): string {
  const parts = clean(locale).replace(/_/g, "-").split("-").filter(Boolean);
  return (parts[0] ?? "en").toLowerCase();
}
function normalizeLocale(locale: string): string {
  const parts = clean(locale).replace(/_/g, "-").split("-").filter(Boolean);
  if (!parts.length) return "en";
  return (parts[0] ?? "en").toLowerCase() + (parts[1] ? "-" + parts[1].toUpperCase() : "");
}
function safeUrl(value: string): string {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}
function resolveUrl(base: string, value: string | undefined): string {
  const v = clean(value);
  if (!v) return "";
  try {
    const baseUrl = safeUrl(base);
    return baseUrl ? new URL(v, baseUrl + "/").toString() : "";
  } catch {
    return "";
  }
}
function inferTitle(name: string, site: string): string {
  const n = clean(name) || site;
  if (!n) return site;
  if (n.toLowerCase() === site.toLowerCase()) return n;
  return limit(n + " | " + site, TITLE_LIMIT);
}
function buildAlternates(c: SeoContext, canonical: string, locale: string): SeoMetadata["alternates"] {
  if (!canonical) return [];
  const configured = c.alternates ?? [];
  const out: { rel: "alternate"; hreflang: string; href: string }[] = [
    { rel: "alternate", hreflang: locale, href: canonical },
  ];
  for (const alternate of configured) {
    const href = safeUrl(alternate.url);
    if (href) out.push({ rel: "alternate", hreflang: normalizeLocale(alternate.locale), href });
  }
  const seen = new Set<string>();
  const unique: { rel: "alternate"; hreflang: string; href: string }[] = [];
  for (const item of out) {
    const key = item.hreflang + "|" + item.href;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  if (!unique.some((item) => item.hreflang === "x-default")) unique.push({ rel: "alternate", hreflang: "x-default", href: canonical });
  return unique;
}

export function generateMetadata(c: SeoContext, url: string, policy?: SeoPolicy): SeoMetadata {
  const entity = c.entity;
  const canonicalUrl = safeUrl(policy?.canonicalUrl || url);
  const language = languageOf(entity.locale);
  const locale = normalizeLocale(entity.locale);
  const siteName = DEFAULT_SITE_NAME;
  const title = inferTitle(entity.preferredName, siteName);
  const description = limit(
    clean(entity.summary) || clean(entity.description) || clean(entity.preferredName) || DESCRIPTION_FALLBACK,
    DESCRIPTION_LIMIT,
  );
  const indexability = policy?.indexability ?? (entity.visibility === "public" && entity.publicationState === "published" ? "index" : "noindex");
  const robots = indexability === "index" ? "index,follow" : "noindex,nofollow";
  const image = resolveUrl(c.canonicalBaseUrl, (entity as SeoEntityWithImage).imageUrl) || resolveUrl(c.canonicalBaseUrl, DEFAULT_IMAGE);
  const openGraph = {
    title,
    description,
    url: canonicalUrl,
    type: entity.type === "Article" ? "article" : "website",
    locale,
    siteName,
    ...(image ? { image } : {}),
  };
  const twitter: SeoMetadata["twitter"] = image
    ? { card: "summary_large_image", title, description, image }
    : { card: "summary", title, description };
  return {
    title,
    description,
    canonicalUrl,
    robots,
    headings: [title],
    altTexts: [],
    openGraph,
    twitter,
    alternates: buildAlternates(c, canonicalUrl, locale),
    language,
    locale,
  };
}

type SeoEntityWithImage = SeoContext["entity"] & { imageUrl?: string };
