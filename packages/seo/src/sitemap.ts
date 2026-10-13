import type { SeoEntity } from "./types";
import type { D1Database } from "@qooqnos/database";
import { canonicalEntityUrl } from "./url";

export interface SitemapEntry {
  readonly url: string;
  readonly lastmod?: string | undefined;
}

export interface RobotsAiPolicy {
  readonly oaiSearchBot?: boolean | undefined;
  readonly gptBot?: boolean | undefined;
  readonly googleExtended?: boolean | undefined;
  readonly claudeBot?: boolean | undefined;
  readonly perplexityBot?: boolean | undefined;
  readonly crawlDelaySeconds?: number | undefined;
}

function escapeXml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeEntries(entries: readonly (string | SitemapEntry)[]): SitemapEntry[] {
  const seen = new Set<string>();
  const result: SitemapEntry[] = [];
  for (const entry of entries) {
    const item = typeof entry === "string" ? { url: entry } : { url: entry.url, lastmod: entry.lastmod };
    const url = item.url.trim();
    if (!url || seen.has(url)) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
    } catch {
      continue;
    }
    seen.add(url);
    result.push(item.lastmod ? { url, lastmod: item.lastmod } : { url });
  }
  return result.sort((a, b) => a.url.localeCompare(b.url));
}

export const SITEMAP_URL_LIMIT = 50000;

export function buildSitemapXml(entries: readonly (string | SitemapEntry)[]): string {
  const body = normalizeEntries(entries)
    .map(
      (entry) =>
        "<url><loc>" +
        escapeXml(entry.url) +
        "</loc>" +
        (entry.lastmod ? "<lastmod>" + escapeXml(entry.lastmod) + "</lastmod>" : "") +
        "</url>",
    )
    .join("");
  return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + body + "</urlset>";
}

export function buildRobotsTxt(
  sitemapUrl: string,
  disallowedPaths: readonly string[] = [
    "/api/",
    "/account",
    "/billing",
    "/customer",
    "/communication",
    "/operations",
    "/trust",
    "/checkout",
  ],
  aiPolicy: RobotsAiPolicy = {},
): string {
  const lines = [
    "User-agent: *",
    "Allow: /",
    ...disallowedPaths.filter(Boolean).map((path) => "Disallow: " + path),
  ];
  const bots: readonly [string, boolean | undefined][] = [
    ["OAI-SearchBot", aiPolicy.oaiSearchBot],
    ["GPTBot", aiPolicy.gptBot],
    ["Google-Extended", aiPolicy.googleExtended],
    ["ClaudeBot", aiPolicy.claudeBot],
    ["PerplexityBot", aiPolicy.perplexityBot],
  ];
  for (const [userAgent, allowed] of bots) {
    if (allowed === undefined) continue;
    lines.push("User-agent: " + userAgent, allowed ? "Allow: /" : "Disallow: /");
  }
  if (
    aiPolicy.crawlDelaySeconds !== undefined &&
    Number.isFinite(aiPolicy.crawlDelaySeconds) &&
    aiPolicy.crawlDelaySeconds >= 0
  ) {
    lines.push("User-agent: *", "Crawl-delay: " + String(aiPolicy.crawlDelaySeconds));
  }
  if (sitemapUrl.trim()) lines.push("Sitemap: " + sitemapUrl.trim());
  return lines.join("\n") + "\n";
}

export function indexableEntities(
  e: readonly SeoEntity[],
  p: (x: SeoEntity) => boolean,
): readonly SeoEntity[] {
  return e.filter(p);
}

export function buildSitemapIndexXml(
  sitemapUrls: readonly (string | { loc: string; lastmod?: string | undefined })[],
): string {
  const seen = new Set<string>();
  const normalized: { loc: string; lastmod?: string | undefined }[] = [];

  for (const item of sitemapUrls) {
    const loc = typeof item === "string" ? item.trim() : item.loc.trim();
    const lastmod = typeof item === "string" ? undefined : item.lastmod;
    if (!loc || seen.has(loc)) continue;
    try {
      const u = new URL(loc);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    } catch {
      continue;
    }
    seen.add(loc);
    normalized.push({ loc, ...(lastmod ? { lastmod } : {}) });
  }

  normalized.sort((a, b) => a.loc.localeCompare(b.loc));

  const body = normalized
    .map(
      (entry) =>
        "<sitemap><loc>" +
        escapeXml(entry.loc) +
        "</loc>" +
        (entry.lastmod ? "<lastmod>" + escapeXml(entry.lastmod) + "</lastmod>" : "") +
        "</sitemap>",
    )
    .join("");
  return '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + body + "</sitemapindex>";
}

export interface ImageSitemapEntry {
  readonly url: string;
  readonly images: readonly string[];
  readonly lastmod?: string | undefined;
}

export function buildImageSitemapXml(entries: readonly ImageSitemapEntry[]): string {
  const normalized = entries
    .map((entry) => ({
      ...entry,
      url: entry.url.trim(),
      images: Array.from(new Set(entry.images.map((image) => image.trim()).filter(Boolean))),
    }))
    .filter((entry) => {
      if (!entry.url || entry.images.length === 0) return false;
      try {
        const u = new URL(entry.url);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.url.localeCompare(b.url));
  const body = normalized
    .map(
      (entry) =>
        "<url><loc>" +
        escapeXml(entry.url) +
        "</loc>" +
        entry.images
          .map((image) => "<image:image><image:loc>" + escapeXml(image) + "</image:loc></image:image>")
          .join("") +
        (entry.lastmod ? "<lastmod>" + escapeXml(entry.lastmod) + "</lastmod>" : "") +
        "</url>",
    )
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' +
    body +
    "</urlset>"
  );
}

/* ========================================================================== */
/* DYNAMIC CATALOG & CATEGORIZED SUB-SITEMAPS GENERATOR                       */
/* ========================================================================== */

export type SitemapContentCategory = "business" | "products" | "articles" | "services" | "offers" | "general";

export interface ActiveBusinessListingItem {
  readonly id: string;
  readonly name: string;
  readonly displayName?: string | null | undefined;
  readonly status: "active" | string;
  readonly publicationStatus?: "published" | string | null | undefined;
  readonly defaultLocale?: string | null | undefined;
  readonly updatedAt?: string | null | undefined;
  readonly createdAt?: string | null | undefined;
}

export interface ActiveCatalogOfferingItem {
  readonly id: string;
  readonly businessId?: string | null | undefined;
  readonly offeringType?: "service" | "product" | string | undefined;
  readonly title?: string | undefined;
  readonly name?: string | undefined;
  readonly status: "active" | string;
  readonly publicationStatus?: "published" | string | null | undefined;
  readonly locale?: string | null | undefined;
  readonly updatedAt?: string | null | undefined;
  readonly createdAt?: string | null | undefined;
}

export interface ActiveArticleItem {
  readonly id: string;
  readonly slug?: string | undefined;
  readonly title: string;
  readonly status: "published" | "active" | string;
  readonly locale?: string | null | undefined;
  readonly updatedAt?: string | null | undefined;
  readonly createdAt?: string | null | undefined;
}

export interface DynamicSitemapCatalogProvider {
  getActiveBusinessListings?(): Promise<readonly ActiveBusinessListingItem[]>;
  getActiveOfferings?(): Promise<readonly ActiveCatalogOfferingItem[]>;
  getActiveProducts?(): Promise<readonly ActiveCatalogOfferingItem[]>;
  getActiveServices?(): Promise<readonly ActiveCatalogOfferingItem[]>;
  getActiveArticles?(): Promise<readonly ActiveArticleItem[]>;
}

export interface DynamicSitemapGeneratorOptions {
  readonly baseUrl: string;
  readonly defaultLocale?: string | undefined;
  readonly now?: (() => string) | undefined;
  readonly maxUrlsPerShard?: number | undefined;
}

export interface SubSitemapOutputFile {
  readonly category: SitemapContentCategory;
  readonly filename: string;
  readonly path: string;
  readonly xml: string;
  readonly count: number;
  readonly lastmod?: string | undefined;
}

export interface CategorizedSitemapsResult {
  /** The root sitemapindex XML referencing all sub-sitemaps (e.g. /sitemap-business.xml, etc.) */
  readonly indexXml: string;
  /** Individual category sub-sitemaps */
  readonly subSitemaps: ReadonlyMap<string, SubSitemapOutputFile>;
  /** Array of sub-sitemap files */
  readonly subSitemapList: readonly SubSitemapOutputFile[];
  /** Total count of URLs across all categories */
  readonly totalUrls: number;
  /** Generated timestamp */
  readonly generatedAt: string;
}

export interface DynamicSitemapResult {
  readonly xml: string;
  readonly isIndex: boolean;
  readonly totalEntries: number;
  readonly entries: readonly SitemapEntry[];
  readonly shards?: readonly { readonly filename: string; readonly xml: string; readonly count: number }[] | undefined;
  readonly categorized?: CategorizedSitemapsResult | undefined;
  readonly generatedAt: string;
}

function formatIsoLastMod(timestamp?: string | null | undefined): string | undefined {
  if (!timestamp) return undefined;
  try {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Crawls active business listings, products, articles, and offerings,
 * producing separate XML sub-sitemaps for each category:
 *  - /sitemap-business.xml
 *  - /sitemap-products.xml
 *  - /sitemap-articles.xml
 * and generates the main sitemap index properly referencing them all.
 */
export async function generateCategorizedCatalogSitemaps(
  provider: DynamicSitemapCatalogProvider | D1Database,
  options: DynamicSitemapGeneratorOptions,
  extraEntriesByCategory: Partial<Record<SitemapContentCategory, readonly (string | SitemapEntry)[]>> = {},
): Promise<CategorizedSitemapsResult> {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const defaultLocale = options.defaultLocale || "fa";
  const now = options.now ? options.now() : new Date().toISOString();

  const businessEntries: SitemapEntry[] = [];
  const productEntries: SitemapEntry[] = [];
  const articleEntries: SitemapEntry[] = [];

  // Helper to append unique entries
  const appendEntries = (target: SitemapEntry[], list: readonly SitemapEntry[]) => {
    const seen = new Set(target.map((e) => e.url));
    for (const item of list) {
      if (!seen.has(item.url)) {
        seen.add(item.url);
        target.push(item);
      }
    }
  };

  // Case 1: Custom In-Memory Provider
  if (!("all" in provider && typeof provider.all === "function")) {
    const p = provider as DynamicSitemapCatalogProvider;

    // 1. Crawl Businesses -> /sitemap-business.xml
    if (p.getActiveBusinessListings) {
      const businesses = await p.getActiveBusinessListings();
      for (const biz of businesses) {
        if (biz.status === "active" && (!biz.publicationStatus || biz.publicationStatus === "published")) {
          const loc = biz.defaultLocale || defaultLocale;
          const entity: SeoEntity = {
            id: biz.id,
            type: "Business",
            sourceModule: "business",
            sourceVersion: "1.0",
            publicationState: "published",
            visibility: "public",
            preferredName: biz.displayName || biz.name,
            locale: loc,
            updatedAt: biz.updatedAt || biz.createdAt || now,
          };
          const url = canonicalEntityUrl(baseUrl, entity);
          const lastmod = formatIsoLastMod(biz.updatedAt || biz.createdAt);
          businessEntries.push({ url, ...(lastmod ? { lastmod } : {}) });
        }
      }
    }

    // 2. Crawl Products / Offerings -> /sitemap-products.xml
    if (p.getActiveProducts) {
      const products = await p.getActiveProducts();
      for (const prod of products) {
        if (prod.status === "active") {
          const entity: SeoEntity = {
            id: prod.id,
            type: "Product",
            sourceModule: "catalog",
            sourceVersion: "1.0",
            publicationState: "published",
            visibility: "public",
            preferredName: prod.title || prod.name || "product",
            locale: prod.locale || defaultLocale,
            updatedAt: prod.updatedAt || prod.createdAt || now,
          };
          const url = canonicalEntityUrl(baseUrl, entity);
          const lastmod = formatIsoLastMod(prod.updatedAt || prod.createdAt);
          productEntries.push({ url, ...(lastmod ? { lastmod } : {}) });
        }
      }
    }

    if (p.getActiveOfferings) {
      const offerings = await p.getActiveOfferings();
      for (const off of offerings) {
        if (off.status === "active" && (!off.publicationStatus || off.publicationStatus === "published")) {
          const loc = off.locale || defaultLocale;
          const type = off.offeringType === "service" ? "Service" : "Product";
          const entity: SeoEntity = {
            id: off.id,
            type: type as SeoEntity["type"],
            sourceModule: "catalog",
            sourceVersion: "1.0",
            publicationState: "published",
            visibility: "public",
            preferredName: off.title || off.name || "offering",
            locale: loc,
            updatedAt: off.updatedAt || off.createdAt || now,
          };
          const url = canonicalEntityUrl(baseUrl, entity);
          const lastmod = formatIsoLastMod(off.updatedAt || off.createdAt);
          productEntries.push({ url, ...(lastmod ? { lastmod } : {}) });
        }
      }
    }

    // 3. Crawl Articles -> /sitemap-articles.xml
    if (p.getActiveArticles) {
      const articles = await p.getActiveArticles();
      for (const art of articles) {
        if (art.status === "published" || art.status === "active") {
          const loc = art.locale || defaultLocale;
          const entity: SeoEntity = {
            id: art.id,
            type: "Article",
            sourceModule: "content",
            sourceVersion: "1.0",
            publicationState: "published",
            visibility: "public",
            preferredName: art.title,
            locale: loc,
            updatedAt: art.updatedAt || art.createdAt || now,
          };
          const url = canonicalEntityUrl(baseUrl, entity);
          const lastmod = formatIsoLastMod(art.updatedAt || art.createdAt);
          articleEntries.push({ url, ...(lastmod ? { lastmod } : {}) });
        }
      }
    }
  }

  // Case 2: D1 Database queries
  else {
    const db = provider as D1Database;

    // 1. Businesses
    try {
      const businesses = await db.all<{
        id: string;
        name: string;
        displayName?: string | null;
        status: string;
        publicationStatus?: string | null;
        defaultLocale?: string | null;
        updatedAt?: string | null;
        createdAt?: string | null;
      }>(
        `SELECT b.id, b.name, b.display_name AS displayName, b.status,
                b.publication_status AS publicationStatus, b.default_locale AS defaultLocale,
                b.updated_at AS updatedAt, b.created_at AS createdAt
           FROM businesses b
          WHERE b.status = 'active'
            AND (b.publication_status = 'published' OR b.publication_status IS NULL)
          ORDER BY b.updated_at DESC`,
      );
      for (const biz of businesses) {
        const entity: SeoEntity = {
          id: biz.id,
          type: "Business",
          sourceModule: "business",
          sourceVersion: "1.0",
          publicationState: "published",
          visibility: "public",
          preferredName: biz.displayName || biz.name,
          locale: biz.defaultLocale || defaultLocale,
          updatedAt: biz.updatedAt || biz.createdAt || now,
        };
        const url = canonicalEntityUrl(baseUrl, entity);
        const lastmod = formatIsoLastMod(biz.updatedAt || biz.createdAt);
        businessEntries.push({ url, ...(lastmod ? { lastmod } : {}) });
      }
    } catch {
      // Ignore
    }

    // 2. Products and Offerings
    try {
      const products = await db.all<{
        id: string;
        name: string;
        status: string;
        updatedAt?: string | null;
        createdAt?: string | null;
      }>(
        `SELECT id, name, status, updated_at AS updatedAt, created_at AS createdAt
           FROM products
          WHERE status = 'active'
          ORDER BY updated_at DESC`,
      );
      for (const prod of products) {
        const entity: SeoEntity = {
          id: prod.id,
          type: "Product",
          sourceModule: "catalog",
          sourceVersion: "1.0",
          publicationState: "published",
          visibility: "public",
          preferredName: prod.name,
          locale: defaultLocale,
          updatedAt: prod.updatedAt || prod.createdAt || now,
        };
        const url = canonicalEntityUrl(baseUrl, entity);
        const lastmod = formatIsoLastMod(prod.updatedAt || prod.createdAt);
        productEntries.push({ url, ...(lastmod ? { lastmod } : {}) });
      }
    } catch {
      // Ignore
    }

    try {
      const offerings = await db.all<{
        id: string;
        title: string;
        offeringType: string;
        status: string;
        publicationStatus: string;
        updatedAt?: string | null;
        createdAt?: string | null;
      }>(
        `SELECT id, title, offering_type AS offeringType, status,
                publication_status AS publicationStatus, updated_at AS updatedAt, created_at AS createdAt
           FROM offerings
          WHERE status = 'active'
            AND (publication_status = 'published' OR publication_status IS NULL)
          ORDER BY updated_at DESC`,
      );
      for (const off of offerings) {
        const type = off.offeringType === "service" ? "Service" : "Product";
        const entity: SeoEntity = {
          id: off.id,
          type: type as SeoEntity["type"],
          sourceModule: "catalog",
          sourceVersion: "1.0",
          publicationState: "published",
          visibility: "public",
          preferredName: off.title,
          locale: defaultLocale,
          updatedAt: off.updatedAt || off.createdAt || now,
        };
        const url = canonicalEntityUrl(baseUrl, entity);
        const lastmod = formatIsoLastMod(off.updatedAt || off.createdAt);
        productEntries.push({ url, ...(lastmod ? { lastmod } : {}) });
      }
    } catch {
      // Ignore
    }

    // 3. Articles from SEO representations
    try {
      const articles = await db.all<{
        canonicalUrl: string;
        generatedAt: string;
      }>(
        `SELECT canonical_url AS canonicalUrl, MAX(generated_at) AS generatedAt
           FROM seo_entity_representations
          WHERE indexability = 'index'
            AND publication_state = 'published'
            AND visibility = 'public'
            AND (entity_type = 'Article' OR canonical_url LIKE '%/article/%')
          GROUP BY canonical_url
          ORDER BY canonical_url ASC`,
      );
      for (const a of articles) {
        if (a.canonicalUrl) {
          articleEntries.push({
            url: a.canonicalUrl,
            lastmod: formatIsoLastMod(a.generatedAt),
          });
        }
      }
    } catch {
      // Ignore
    }
  }

  // Add extra user-defined entries
  if (extraEntriesByCategory.business) {
    appendEntries(
      businessEntries,
      extraEntriesByCategory.business.map((e) => (typeof e === "string" ? { url: e } : e)),
    );
  }
  if (extraEntriesByCategory.products) {
    appendEntries(
      productEntries,
      extraEntriesByCategory.products.map((e) => (typeof e === "string" ? { url: e } : e)),
    );
  }
  if (extraEntriesByCategory.articles) {
    appendEntries(
      articleEntries,
      extraEntriesByCategory.articles.map((e) => (typeof e === "string" ? { url: e } : e)),
    );
  }

  // Generate Sub-Sitemaps
  const subSitemapsMap = new Map<string, SubSitemapOutputFile>();
  const subSitemapList: SubSitemapOutputFile[] = [];
  const indexReferences: { loc: string; lastmod?: string | undefined }[] = [];
  let totalUrls = 0;

  const categoriesToBuild: { category: SitemapContentCategory; filename: string; entries: SitemapEntry[] }[] = [
    { category: "business", filename: "sitemap-business.xml", entries: businessEntries },
    { category: "products", filename: "sitemap-products.xml", entries: productEntries },
    { category: "articles", filename: "sitemap-articles.xml", entries: articleEntries },
  ];

  for (const item of categoriesToBuild) {
    // If entries are empty, provide an empty urlset rather than missing
    const xml = buildSitemapXml(item.entries);
    totalUrls += item.entries.length;

    let latestMod: string | undefined = undefined;
    for (const e of item.entries) {
      if (e.lastmod && (!latestMod || e.lastmod > latestMod)) {
        latestMod = e.lastmod;
      }
    }
    const lastmod = latestMod ?? now;
    const path = `/${item.filename}`;
    const loc = `${baseUrl}/${item.filename}`;

    const subFile: SubSitemapOutputFile = {
      category: item.category,
      filename: item.filename,
      path,
      xml,
      count: item.entries.length,
      lastmod,
    };

    subSitemapsMap.set(item.filename, subFile);
    subSitemapList.push(subFile);
    indexReferences.push({ loc, lastmod });
  }

  // Main sitemapindex referencing all sub-sitemaps
  const indexXml = buildSitemapIndexXml(indexReferences);

  return {
    indexXml,
    subSitemaps: subSitemapsMap,
    subSitemapList,
    totalUrls,
    generatedAt: now,
  };
}

/**
 * Backward-compatible catalog sitemap generator that returns either a single urlset
 * or a full sitemap index referencing categorized sub-sitemaps.
 */
export async function generateCatalogSitemapXml(
  provider: DynamicSitemapCatalogProvider | D1Database,
  options: DynamicSitemapGeneratorOptions,
  staticEntries: readonly (string | SitemapEntry)[] = [],
): Promise<DynamicSitemapResult> {
  const now = options.now ? options.now() : new Date().toISOString();

  // Generate categorized sub-sitemaps
  const categorized = await generateCategorizedCatalogSitemaps(provider, options);

  // Static entries are kept in the legacy response shape; canonical sitemap entries live in categorized.
  const allEntriesList: SitemapEntry[] = [];
  for (const s of staticEntries) {
    allEntriesList.push(typeof s === "string" ? { url: s } : s);
  }

  // If categorized sitemap index is preferred
  return {
    xml: categorized.indexXml,
    isIndex: true,
    totalEntries: categorized.totalUrls,
    entries: allEntriesList,
    categorized,
    generatedAt: now,
  };
}
