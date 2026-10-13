import { describe, it, expect } from "vitest";
import {
  generateCategorizedCatalogSitemaps,
  generateCatalogSitemapXml,
  type DynamicSitemapCatalogProvider,
} from "./sitemap";

describe("Categorized Sub-Sitemaps & Main Index (packages/seo/src/sitemap.ts)", () => {
  const baseUrl = "https://qooqnos.com";

  const mockProvider: DynamicSitemapCatalogProvider = {
    async getActiveBusinessListings() {
      return [
        {
          id: "biz-1",
          name: "فروشگاه تکنولوژی تهران",
          displayName: "فروشگاه تکنولوژی",
          status: "active",
          publicationStatus: "published",
          defaultLocale: "fa",
          updatedAt: "2026-06-01T10:00:00Z",
        },
      ];
    },
    async getActiveProducts() {
      return [
        {
          id: "prod-1",
          name: "لپ‌تاپ گیمینگ ایسوس",
          status: "active",
          locale: "fa",
          updatedAt: "2026-06-02T11:00:00Z",
        },
      ];
    },
    async getActiveOfferings() {
      return [
        {
          id: "off-1",
          title: "خدمات پشتیبانی فنی",
          offeringType: "service",
          status: "active",
          publicationStatus: "published",
          locale: "fa",
          updatedAt: "2026-06-03T12:00:00Z",
        },
      ];
    },
    async getActiveArticles() {
      return [
        {
          id: "art-1",
          title: "راهنمای خرید لپ‌تاپ",
          status: "published",
          locale: "fa",
          updatedAt: "2026-06-04T14:00:00Z",
        },
      ];
    },
  };

  it("generates separate XML sub-sitemaps for business, products, and articles", async () => {
    const result = await generateCategorizedCatalogSitemaps(mockProvider, {
      baseUrl,
      defaultLocale: "fa",
    });

    expect(result.subSitemaps.has("sitemap-business.xml")).toBe(true);
    expect(result.subSitemaps.has("sitemap-products.xml")).toBe(true);
    expect(result.subSitemaps.has("sitemap-articles.xml")).toBe(true);

    // Business sub-sitemap check
    const bizSub = result.subSitemaps.get("sitemap-business.xml");
    expect(bizSub?.count).toBe(1);
    expect(bizSub?.xml).toContain("<loc>https://qooqnos.com/fa/business/");
    expect(bizSub?.xml).not.toContain("product");
    expect(bizSub?.xml).not.toContain("article");

    // Products sub-sitemap check (includes products and offerings)
    const prodSub = result.subSitemaps.get("sitemap-products.xml");
    expect(prodSub?.count).toBe(2);
    expect(prodSub?.xml).toContain("<loc>https://qooqnos.com/fa/product/");
    expect(prodSub?.xml).toContain("<loc>https://qooqnos.com/fa/service/");
    expect(prodSub?.xml).not.toContain("article");

    // Articles sub-sitemap check
    const artSub = result.subSitemaps.get("sitemap-articles.xml");
    expect(artSub?.count).toBe(1);
    expect(artSub?.xml).toContain("<loc>https://qooqnos.com/fa/article/");

    // Main sitemapindex references all sub-sitemaps
    expect(result.indexXml).toContain("<sitemapindex");
    expect(result.indexXml).toContain("<loc>https://qooqnos.com/sitemap-business.xml</loc>");
    expect(result.indexXml).toContain("<loc>https://qooqnos.com/sitemap-products.xml</loc>");
    expect(result.indexXml).toContain("<loc>https://qooqnos.com/sitemap-articles.xml</loc>");
  });

  it("generateCatalogSitemapXml defaults to the main sitemap index referencing the sub-sitemaps", async () => {
    const dynamicResult = await generateCatalogSitemapXml(mockProvider, {
      baseUrl,
      defaultLocale: "fa",
    });

    expect(dynamicResult.isIndex).toBe(true);
    expect(dynamicResult.xml).toContain("<sitemapindex");
    expect(dynamicResult.xml).toContain("<loc>https://qooqnos.com/sitemap-business.xml</loc>");
    expect(dynamicResult.xml).toContain("<loc>https://qooqnos.com/sitemap-products.xml</loc>");
    expect(dynamicResult.xml).toContain("<loc>https://qooqnos.com/sitemap-articles.xml</loc>");
    expect(dynamicResult.categorized?.subSitemapList.length).toBe(3);
  });
});
