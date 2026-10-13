/**
 * Google-compliant XML Sitemap & Sitemap Index Schema and Builder.
 * Supports categorization and sub-sitemaps (business, products, articles, services, offers)
 * to maximize search engine indexing efficiency.
 */

export type SitemapChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export type SitemapCategory =
  | "business"
  | "products"
  | "articles"
  | "services"
  | "offers"
  | "general"
  | (string & {});

export interface SitemapUrlEntry {
  /** Canonical URL of the page (must start with http/https) */
  readonly loc: string;
  /** ISO 8601 date format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ) */
  readonly lastmod?: string | undefined;
  /** Expected change frequency of the resource */
  readonly changefreq?: SitemapChangeFrequency | undefined;
  /** Priority of this URL relative to other URLs on your site (0.0 to 1.0) */
  readonly priority?: number | undefined;
  /** Category or content partition tag (e.g. "business", "products", "articles") */
  readonly category?: SitemapCategory | undefined;
}

export interface SubSitemapMeta {
  readonly category: SitemapCategory;
  readonly filename: string;
  readonly loc: string;
  readonly lastmod?: string | undefined;
  readonly count: number;
}

export interface CategorizedSitemapBundle {
  /** The root sitemapindex XML content pointing to all categorized sub-sitemaps */
  readonly indexXml: string;
  /** Map of sub-sitemap filename to its generated XML */
  readonly subSitemaps: ReadonlyMap<string, {
    readonly category: SitemapCategory;
    readonly filename: string;
    readonly xml: string;
    readonly count: number;
  }>;
  /** List of sub-sitemap metadata */
  readonly subSitemapList: readonly SubSitemapMeta[];
  /** Total count of URLs across all categorized sub-sitemaps */
  readonly totalUrls: number;
}

export const GOOGLE_SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
export const GOOGLE_MAX_URLS_PER_SITEMAP = 50000;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Builds a single Google-compliant XML sitemap from a list of URL entries.
 */
export function buildGoogleUrlsetXml(entries: readonly SitemapUrlEntry[]): string {
  const seen = new Set<string>();
  const validEntries: SitemapUrlEntry[] = [];

  for (const entry of entries) {
    const validLoc = normalizeUrl(entry.loc);
    if (!validLoc || seen.has(validLoc)) continue;
    seen.add(validLoc);
    validEntries.push({
      ...entry,
      loc: validLoc,
    });
  }

  // Sort deterministically by loc
  validEntries.sort((a, b) => a.loc.localeCompare(b.loc));

  const xmlBody = validEntries
    .map((item) => {
      let node = `<url><loc>${escapeXml(item.loc)}</loc>`;
      if (item.lastmod) {
        node += `<lastmod>${escapeXml(item.lastmod)}</lastmod>`;
      }
      if (item.changefreq) {
        node += `<changefreq>${escapeXml(item.changefreq)}</changefreq>`;
      }
      if (item.priority !== undefined && Number.isFinite(item.priority)) {
        const clamped = Math.min(1.0, Math.max(0.0, item.priority));
        node += `<priority>${clamped.toFixed(1)}</priority>`;
      }
      node += `</url>`;
      return node;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="${GOOGLE_SITEMAP_NAMESPACE}">${xmlBody}</urlset>`;
}

/**
 * Builds a Google-compliant Sitemap Index XML pointing to sub-sitemaps.
 */
export function buildGoogleSitemapIndexXml(subSitemaps: readonly { loc: string; lastmod?: string | undefined }[]): string {
  const seen = new Set<string>();
  const validSitemaps: { loc: string; lastmod?: string | undefined }[] = [];

  for (const sub of subSitemaps) {
    const validLoc = normalizeUrl(sub.loc);
    if (!validLoc || seen.has(validLoc)) continue;
    seen.add(validLoc);
    validSitemaps.push({ loc: validLoc, ...(sub.lastmod ? { lastmod: sub.lastmod } : {}) });
  }

  validSitemaps.sort((a, b) => a.loc.localeCompare(b.loc));

  const xmlBody = validSitemaps
    .map((item) => {
      let node = `<sitemap><loc>${escapeXml(item.loc)}</loc>`;
      if (item.lastmod) {
        node += `<lastmod>${escapeXml(item.lastmod)}</lastmod>`;
      }
      node += `</sitemap>`;
      return node;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="${GOOGLE_SITEMAP_NAMESPACE}">${xmlBody}</sitemapindex>`;
}

/**
 * Partitions entries by category (e.g. business, products, articles)
 * and generates sub-sitemaps plus a root sitemap index.
 */
export function generateCategorizedSitemaps(
  entries: readonly SitemapUrlEntry[],
  options: {
    readonly baseUrl: string;
    readonly defaultCategory?: SitemapCategory | undefined;
    readonly maxUrlsPerSubSitemap?: number | undefined;
    readonly now?: string | undefined;
  },
): CategorizedSitemapBundle {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const defaultCategory = options.defaultCategory ?? "general";
  const limit = options.maxUrlsPerSubSitemap ?? GOOGLE_MAX_URLS_PER_SITEMAP;
  const now = options.now ?? new Date().toISOString();

  // Group entries by category
  const categorizedMap = new Map<SitemapCategory, SitemapUrlEntry[]>();

  for (const entry of entries) {
    const cat = entry.category ?? defaultCategory;
    let list = categorizedMap.get(cat);
    if (!list) {
      list = [];
      categorizedMap.set(cat, list);
    }
    list.push(entry);
  }

  const subSitemapsMap = new Map<string, {
    readonly category: SitemapCategory;
    readonly filename: string;
    readonly xml: string;
    readonly count: number;
  }>();

  const subSitemapList: SubSitemapMeta[] = [];
  const indexEntries: { loc: string; lastmod?: string | undefined }[] = [];
  let totalUrls = 0;

  // Process categories in sorted order for determinism
  const sortedCategories = Array.from(categorizedMap.keys()).sort();

  for (const category of sortedCategories) {
    const catEntries = categorizedMap.get(category) ?? [];
    if (catEntries.length === 0) continue;

    // Handle sharding within category if needed
    const shardCount = Math.ceil(catEntries.length / limit);

    for (let shardIndex = 0; shardIndex < shardCount; shardIndex++) {
      const chunk = catEntries.slice(shardIndex * limit, (shardIndex + 1) * limit);
      const filename = shardCount === 1
        ? `sitemap-${category}.xml`
        : `sitemap-${category}-${shardIndex + 1}.xml`;
      const loc = `${baseUrl}/${filename}`;

      const xml = buildGoogleUrlsetXml(chunk);
      totalUrls += chunk.length;

      // Find newest lastmod in chunk
      let latestMod: string | undefined = undefined;
      for (const item of chunk) {
        if (item.lastmod && (!latestMod || item.lastmod > latestMod)) {
          latestMod = item.lastmod;
        }
      }
      const lastmod = latestMod ?? now;

      subSitemapsMap.set(filename, {
        category,
        filename,
        xml,
        count: chunk.length,
      });

      const meta: SubSitemapMeta = {
        category,
        filename,
        loc,
        lastmod,
        count: chunk.length,
      };

      subSitemapList.push(meta);
      indexEntries.push({ loc, lastmod });
    }
  }

  const indexXml = buildGoogleSitemapIndexXml(indexEntries);

  return {
    indexXml,
    subSitemaps: subSitemapsMap,
    subSitemapList,
    totalUrls,
  };
}
