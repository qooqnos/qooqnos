import type { D1Database } from "@qooqnos/database";
import { buildSitemapXml, buildSitemapIndexXml, type SitemapEntry } from "./sitemap";
import { canonicalEntityUrl } from "./url";
import type { SeoEntity } from "./types";

export interface SitemapCrawlerCatalogItem {
  readonly id: string;
  readonly businessId?: string | null | undefined;
  readonly name: string;
  readonly description?: string | null | undefined;
  readonly status: string;
  readonly updatedAt?: string | null | undefined;
  readonly createdAt?: string | null | undefined;
  readonly locale?: string | null | undefined;
}

export interface SitemapCrawlerBusinessProfile {
  readonly id: string;
  readonly name: string;
  readonly displayName?: string | null | undefined;
  readonly status: string;
  readonly publicationStatus?: string | null | undefined;
  readonly defaultLocale?: string | null | undefined;
  readonly updatedAt?: string | null | undefined;
  readonly createdAt?: string | null | undefined;
}

export interface SitemapCrawlerDataSource {
  getCatalogProducts?(): Promise<readonly SitemapCrawlerCatalogItem[]>;
  getCatalogServices?(): Promise<readonly SitemapCrawlerCatalogItem[]>;
  getCatalogOfferings?(): Promise<readonly SitemapCrawlerCatalogItem[]>;
  getActiveBusinessProfiles?(): Promise<readonly SitemapCrawlerBusinessProfile[]>;
}

export interface SitemapGenerationOptions {
  readonly baseUrl: string;
  readonly defaultLocale?: string | undefined;
  readonly now?: (() => string) | undefined;
  readonly maxUrlsPerSitemap?: number | undefined;
}

export interface SitemapGenerationResult {
  readonly xml: string;
  readonly isIndex: boolean;
  readonly totalUrls: number;
  readonly shards?: readonly { readonly filename: string; readonly xml: string; readonly count: number }[] | undefined;
  readonly generatedAt: string;
}

/**
 * Normalizes an ISO timestamp string to YYYY-MM-DD or standard ISO 8601 for <lastmod>.
 */
function normalizeLastMod(timestamp?: string | null): string | undefined {
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
 * Automated Sitemap Generator Service that crawls catalog items and active business profiles.
 * Maintains search engine indexing freshness and builds standard XML sitemaps or sitemap indexes.
 */
function isD1Database(value: SitemapCrawlerDataSource | D1Database): value is D1Database {
  return "all" in value && typeof value.all === "function";
}

export class AutomatedSitemapGeneratorService {
  constructor(
    private readonly dataSource?: SitemapCrawlerDataSource | D1Database | undefined,
    private readonly defaultOptions?: Partial<SitemapGenerationOptions> | undefined,
  ) {}

  /**
   * Crawls catalog products, services, offerings and active business profiles
   * from the provided data source or D1 database.
   */
  async crawlEntities(
    options?: { readonly defaultLocale?: string | undefined; readonly baseUrl?: string | undefined },
  ): Promise<SitemapEntry[]> {
    const defaultLocale = options?.defaultLocale ?? this.defaultOptions?.defaultLocale ?? "fa";
    const baseUrl = (options?.baseUrl ?? this.defaultOptions?.baseUrl ?? "https://qooqnos.com").replace(/\/+$/, "");

    const entriesMap = new Map<string, SitemapEntry>();

    // Case 1: Custom DataSource provider
    if (this.dataSource && !isD1Database(this.dataSource)) {
      const ds = this.dataSource as SitemapCrawlerDataSource;

      // 1. Crawl Active Business Profiles
      if (ds.getActiveBusinessProfiles) {
        const businesses = await ds.getActiveBusinessProfiles();
        for (const biz of businesses) {
          if (biz.status === "active" && (!biz.publicationStatus || biz.publicationStatus === "published")) {
            const loc = biz.defaultLocale || defaultLocale;
            const preferredName = biz.displayName || biz.name;
            const entity: SeoEntity = {
              id: biz.id,
              type: "Business",
              sourceModule: "business",
              sourceVersion: "1.0",
              publicationState: "published",
              visibility: "public",
              preferredName,
              locale: loc,
              updatedAt: biz.updatedAt || biz.createdAt || new Date().toISOString(),
            };
            const url = canonicalEntityUrl(baseUrl, entity);
            const lastmod = normalizeLastMod(biz.updatedAt || biz.createdAt);
            entriesMap.set(url, { url, ...(lastmod ? { lastmod } : {}) });
          }
        }
      }

      // 2. Crawl Catalog Products
      if (ds.getCatalogProducts) {
        const products = await ds.getCatalogProducts();
        for (const prod of products) {
          if (prod.status === "active") {
            const loc = prod.locale || defaultLocale;
            const entity: SeoEntity = {
              id: prod.id,
              type: "Product",
              sourceModule: "catalog",
              sourceVersion: "1.0",
              publicationState: "published",
              visibility: "public",
              preferredName: prod.name,
              locale: loc,
              updatedAt: prod.updatedAt || prod.createdAt || new Date().toISOString(),
            };
            const url = canonicalEntityUrl(baseUrl, entity);
            const lastmod = normalizeLastMod(prod.updatedAt || prod.createdAt);
            entriesMap.set(url, { url, ...(lastmod ? { lastmod } : {}) });
          }
        }
      }

      // 3. Crawl Catalog Services
      if (ds.getCatalogServices) {
        const services = await ds.getCatalogServices();
        for (const srv of services) {
          if (srv.status === "active") {
            const loc = srv.locale || defaultLocale;
            const entity: SeoEntity = {
              id: srv.id,
              type: "Service",
              sourceModule: "catalog",
              sourceVersion: "1.0",
              publicationState: "published",
              visibility: "public",
              preferredName: srv.name,
              locale: loc,
              updatedAt: srv.updatedAt || srv.createdAt || new Date().toISOString(),
            };
            const url = canonicalEntityUrl(baseUrl, entity);
            const lastmod = normalizeLastMod(srv.updatedAt || srv.createdAt);
            entriesMap.set(url, { url, ...(lastmod ? { lastmod } : {}) });
          }
        }
      }

      // 4. Crawl Catalog Offerings
      if (ds.getCatalogOfferings) {
        const offerings = await ds.getCatalogOfferings();
        for (const off of offerings) {
          if (off.status === "active") {
            const loc = off.locale || defaultLocale;
            const entity: SeoEntity = {
              id: off.id,
              type: "Offer",
              sourceModule: "catalog",
              sourceVersion: "1.0",
              publicationState: "published",
              visibility: "public",
              preferredName: off.name,
              locale: loc,
              updatedAt: off.updatedAt || off.createdAt || new Date().toISOString(),
            };
            const url = canonicalEntityUrl(baseUrl, entity);
            const lastmod = normalizeLastMod(off.updatedAt || off.createdAt);
            entriesMap.set(url, { url, ...(lastmod ? { lastmod } : {}) });
          }
        }
      }
    }

    // Case 2: D1 Database queries
    else if (this.dataSource && isD1Database(this.dataSource)) {
      const db = this.dataSource;

      // 1. Crawl Active Businesses & Profiles
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
          const loc = biz.defaultLocale || defaultLocale;
          const preferredName = biz.displayName || biz.name;
          const entity: SeoEntity = {
            id: biz.id,
            type: "Business",
            sourceModule: "business",
            sourceVersion: "1.0",
            publicationState: "published",
            visibility: "public",
            preferredName,
            locale: loc,
            updatedAt: biz.updatedAt || biz.createdAt || new Date().toISOString(),
          };
          const url = canonicalEntityUrl(baseUrl, entity);
          const lastmod = normalizeLastMod(biz.updatedAt || biz.createdAt);
          entriesMap.set(url, { url, ...(lastmod ? { lastmod } : {}) });
        }
      } catch {
        // Table may not exist in some environments; safely proceed
      }

      // 2. Crawl Catalog Products
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
            updatedAt: prod.updatedAt || prod.createdAt || new Date().toISOString(),
          };
          const url = canonicalEntityUrl(baseUrl, entity);
          const lastmod = normalizeLastMod(prod.updatedAt || prod.createdAt);
          entriesMap.set(url, { url, ...(lastmod ? { lastmod } : {}) });
        }
      } catch {
        // Continue
      }

      // 3. Crawl Catalog Services
      try {
        const services = await db.all<{
          id: string;
          name: string;
          status: string;
          updatedAt?: string | null;
          createdAt?: string | null;
        }>(
          `SELECT id, name, status, updated_at AS updatedAt, created_at AS createdAt
             FROM services
            WHERE status = 'active'
            ORDER BY updated_at DESC`,
        );

        for (const srv of services) {
          const entity: SeoEntity = {
            id: srv.id,
            type: "Service",
            sourceModule: "catalog",
            sourceVersion: "1.0",
            publicationState: "published",
            visibility: "public",
            preferredName: srv.name,
            locale: defaultLocale,
            updatedAt: srv.updatedAt || srv.createdAt || new Date().toISOString(),
          };
          const url = canonicalEntityUrl(baseUrl, entity);
          const lastmod = normalizeLastMod(srv.updatedAt || srv.createdAt);
          entriesMap.set(url, { url, ...(lastmod ? { lastmod } : {}) });
        }
      } catch {
        // Continue
      }

      // 4. Crawl Published SEO Entity Representations (authority index)
      try {
        const seoEntities = await db.all<{
          canonicalUrl: string;
          generatedAt: string;
        }>(
          `SELECT canonical_url AS canonicalUrl, MAX(generated_at) AS generatedAt
             FROM seo_entity_representations
            WHERE indexability = 'index'
              AND publication_state = 'published'
              AND visibility = 'public'
            GROUP BY canonical_url
            ORDER BY canonical_url ASC`,
        );

        for (const r of seoEntities) {
          if (r.canonicalUrl) {
            const lastmod = normalizeLastMod(r.generatedAt);
            entriesMap.set(r.canonicalUrl, {
              url: r.canonicalUrl,
              ...(lastmod ? { lastmod } : {}),
            });
          }
        }
      } catch {
        // Continue
      }
    }

    return Array.from(entriesMap.values()).sort((a, b) => a.url.localeCompare(b.url));
  }

  /**
   * Generates sitemap XML content. If the URL count exceeds the sitemap limit (e.g. 50,000),
   * generates a Sitemap Index and returns the shards.
   */
  async generateSitemap(
    customOptions?: Partial<SitemapGenerationOptions>,
    staticAdditionalEntries: readonly (string | SitemapEntry)[] = [],
  ): Promise<SitemapGenerationResult> {
    const baseUrl = (customOptions?.baseUrl ?? this.defaultOptions?.baseUrl ?? "https://qooqnos.com").replace(/\/+$/, "");
    const limit = customOptions?.maxUrlsPerSitemap ?? this.defaultOptions?.maxUrlsPerSitemap ?? SITEMAP_URL_LIMIT;
    const nowFn = customOptions?.now ?? this.defaultOptions?.now ?? (() => new Date().toISOString());
    const generatedAt = nowFn();

    // 1. Crawl all dynamic entries from catalog & business profiles
    const crawledEntries = await this.crawlEntities({
      baseUrl,
      defaultLocale: customOptions?.defaultLocale ?? this.defaultOptions?.defaultLocale,
    });

    // 2. Merge with any additional entries
    const allEntriesMap = new Map<string, SitemapEntry>();
    for (const entry of crawledEntries) {
      allEntriesMap.set(entry.url, entry);
    }
    for (const entry of staticAdditionalEntries) {
      const item: SitemapEntry = typeof entry === "string" ? { url: entry } : entry;
      allEntriesMap.set(item.url, item);
    }

    const allEntries = Array.from(allEntriesMap.values()).sort((a, b) => a.url.localeCompare(b.url));
    const totalUrls = allEntries.length;

    // 3. Shard if exceeds limit
    if (totalUrls > limit) {
      const shardCount = Math.ceil(totalUrls / limit);
      const shards: { readonly filename: string; readonly xml: string; readonly count: number }[] = [];
      const sitemapIndexUrls: string[] = [];

      for (let i = 0; i < shardCount; i++) {
        const chunk = allEntries.slice(i * limit, (i + 1) * limit);
        const filename = `sitemap-${i + 1}.xml`;
        const shardXml = buildSitemapXml(chunk);
        shards.push({
          filename,
          xml: shardXml,
          count: chunk.length,
        });
        sitemapIndexUrls.push(`${baseUrl}/${filename}`);
      }

      const indexXml = buildSitemapIndexXml(sitemapIndexUrls);

      return {
        xml: indexXml,
        isIndex: true,
        totalUrls,
        shards,
        generatedAt,
      };
    }

    // 4. Standard single sitemap
    const xml = buildSitemapXml(allEntries);
    return {
      xml,
      isIndex: false,
      totalUrls,
      generatedAt,
    };
  }
}
