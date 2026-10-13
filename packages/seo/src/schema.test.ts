import { describe, it, expect } from "vitest";
import {
  buildGoogleUrlsetXml,
  buildGoogleSitemapIndexXml,
  generateCategorizedSitemaps,
  GOOGLE_SITEMAP_NAMESPACE,
  type SitemapUrlEntry,
} from "./schema";

describe("Google-compliant XML Sitemap Schema (packages/seo/src/schema.ts)", () => {
  const baseUrl = "https://qooqnos.com";

  it("builds a valid Google urlset XML with changefreq, priority, and lastmod", () => {
    const entries: SitemapUrlEntry[] = [
      {
        loc: "https://qooqnos.com/fa/business/tech-store",
        lastmod: "2026-06-01T12:00:00Z",
        changefreq: "weekly",
        priority: 0.9,
      },
      {
        loc: "https://qooqnos.com/fa/products/laptop-pro",
        lastmod: "2026-06-02T10:00:00Z",
        changefreq: "daily",
        priority: 0.8,
      },
    ];

    const xml = buildGoogleUrlsetXml(entries);

    expect(xml).toContain(`xmlns="${GOOGLE_SITEMAP_NAMESPACE}"`);
    expect(xml).toContain("<loc>https://qooqnos.com/fa/business/tech-store</loc>");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
    expect(xml).toContain("<priority>0.9</priority>");
    expect(xml).toContain("<lastmod>2026-06-01T12:00:00Z</lastmod>");
  });

  it("generates categorized sub-sitemaps and a sitemapindex for business, products, and articles", () => {
    const entries: SitemapUrlEntry[] = [
      {
        loc: "https://qooqnos.com/fa/business/store-a",
        category: "business",
        lastmod: "2026-05-10T00:00:00Z",
      },
      {
        loc: "https://qooqnos.com/fa/business/store-b",
        category: "business",
        lastmod: "2026-05-12T00:00:00Z",
      },
      {
        loc: "https://qooqnos.com/fa/products/product-1",
        category: "products",
        lastmod: "2026-05-15T00:00:00Z",
      },
      {
        loc: "https://qooqnos.com/fa/articles/seo-guide",
        category: "articles",
        lastmod: "2026-05-20T00:00:00Z",
      },
    ];

    const bundle = generateCategorizedSitemaps(entries, { baseUrl });

    expect(bundle.totalUrls).toBe(4);
    expect(bundle.subSitemapList.length).toBe(3); // business, products, articles

    // Check Sub-Sitemap filenames
    expect(bundle.subSitemaps.has("sitemap-business.xml")).toBe(true);
    expect(bundle.subSitemaps.has("sitemap-products.xml")).toBe(true);
    expect(bundle.subSitemaps.has("sitemap-articles.xml")).toBe(true);

    // Business sub-sitemap contains only business entries
    const bizXml = bundle.subSitemaps.get("sitemap-business.xml")?.xml;
    expect(bizXml).toContain("<loc>https://qooqnos.com/fa/business/store-a</loc>");
    expect(bizXml).toContain("<loc>https://qooqnos.com/fa/business/store-b</loc>");
    expect(bizXml).not.toContain("product-1");

    // Articles sub-sitemap contains only article entries
    const articlesXml = bundle.subSitemaps.get("sitemap-articles.xml")?.xml;
    expect(articlesXml).toContain("<loc>https://qooqnos.com/fa/articles/seo-guide</loc>");
    expect(articlesXml).not.toContain("store-a");

    // Root sitemapindex XML links to all sub-sitemaps
    expect(bundle.indexXml).toContain("<sitemapindex");
    expect(bundle.indexXml).toContain("<loc>https://qooqnos.com/sitemap-business.xml</loc>");
    expect(bundle.indexXml).toContain("<loc>https://qooqnos.com/sitemap-products.xml</loc>");
    expect(bundle.indexXml).toContain("<loc>https://qooqnos.com/sitemap-articles.xml</loc>");
  });

  it("builds a clean sitemapindex XML", () => {
    const subs = [
      { loc: "https://qooqnos.com/sitemap-business.xml", lastmod: "2026-06-01T00:00:00Z" },
      { loc: "https://qooqnos.com/sitemap-products.xml" },
    ];
    const indexXml = buildGoogleSitemapIndexXml(subs);

    expect(indexXml).toContain("<sitemapindex");
    expect(indexXml).toContain("<loc>https://qooqnos.com/sitemap-business.xml</loc>");
    expect(indexXml).toContain("<lastmod>2026-06-01T00:00:00Z</lastmod>");
  });
});
