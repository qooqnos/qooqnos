import { describe, it, expect } from "vitest";
import {
  AutomatedSitemapGeneratorService,
  type SitemapCrawlerDataSource,
  type SitemapCrawlerCatalogItem,
  type SitemapCrawlerBusinessProfile,
} from "./automated-sitemap";
import { SITEMAP_URL_LIMIT } from "./sitemap";

describe("AutomatedSitemapGeneratorService (SEO Package)", () => {
  const baseUrl = "https://qooqnos.com";

  it("crawls catalog products, services, offerings and active business profiles into sitemap entries", async () => {
    const mockProducts: SitemapCrawlerCatalogItem[] = [
      {
        id: "prod-laptop-dell",
        name: "لپ‌تاپ دل مدل پرسیژن",
        status: "active",
        locale: "fa",
        updatedAt: "2026-05-10T14:30:00Z",
      },
      {
        id: "prod-draft-item",
        name: "محصول پیش‌نویس غیرفعال",
        status: "draft", // Should be ignored!
        locale: "fa",
      },
    ];

    const mockServices: SitemapCrawlerCatalogItem[] = [
      {
        id: "srv-consulting",
        name: "مشاوره سئو و رشد فروشگاه",
        status: "active",
        locale: "fa",
        updatedAt: "2026-06-01T08:00:00Z",
      },
    ];

    const mockOfferings: SitemapCrawlerCatalogItem[] = [
      {
        id: "off-special-course",
        name: "دوره تخصصی هوش تجاری",
        status: "active",
        locale: "fa",
        updatedAt: "2026-07-01T12:00:00Z",
      },
    ];

    const mockBusinesses: SitemapCrawlerBusinessProfile[] = [
      {
        id: "biz-tehran-tech",
        name: "تهران تک",
        displayName: "فروشگاه بزرگ تهران تک",
        status: "active",
        publicationStatus: "published",
        defaultLocale: "fa",
        updatedAt: "2026-05-20T10:00:00Z",
      },
      {
        id: "biz-suspended-shop",
        name: "فروشگاه مسدود",
        status: "suspended", // Should be ignored!
        publicationStatus: "published",
      },
      {
        id: "biz-unpublished-draft",
        name: "کسب‌وکار منتشر نشده",
        status: "active",
        publicationStatus: "unpublished", // Should be ignored!
      },
    ];

    const mockDataSource: SitemapCrawlerDataSource = {
      async getCatalogProducts() {
        return mockProducts;
      },
      async getCatalogServices() {
        return mockServices;
      },
      async getCatalogOfferings() {
        return mockOfferings;
      },
      async getActiveBusinessProfiles() {
        return mockBusinesses;
      },
    };

    const service = new AutomatedSitemapGeneratorService(mockDataSource, {
      baseUrl,
      defaultLocale: "fa",
    });

    const entries = await service.crawlEntities();

    // Expecting 4 active valid entries: 1 product, 1 service, 1 offering, 1 business
    expect(entries.length).toBe(4);

    // Verify canonical URLs and dates are formatted properly
    const bizEntry = entries.find((e) => e.url.includes("business"));
    expect(bizEntry).toBeDefined();
    expect(bizEntry?.lastmod).toBe("2026-05-20T10:00:00.000Z");

    const prodEntry = entries.find((e) => e.url.includes("product"));
    expect(prodEntry).toBeDefined();
    expect(prodEntry?.lastmod).toBe("2026-05-10T14:30:00.000Z");

    const srvEntry = entries.find((e) => e.url.includes("service"));
    expect(srvEntry).toBeDefined();

    const offEntry = entries.find((e) => e.url.includes("offer"));
    expect(offEntry).toBeDefined();
  });

  it("generates a valid XML sitemap string with urlset", async () => {
    const mockDataSource: SitemapCrawlerDataSource = {
      async getCatalogProducts() {
        return [
          {
            id: "prod-1",
            name: "کفش ورزشی نایک",
            status: "active",
            locale: "fa",
            updatedAt: "2026-03-01T00:00:00Z",
          },
        ];
      },
      async getActiveBusinessProfiles() {
        return [
          {
            id: "biz-1",
            name: "فروشگاه نایک تهران",
            status: "active",
            publicationStatus: "published",
            defaultLocale: "fa",
            updatedAt: "2026-03-02T00:00:00Z",
          },
        ];
      },
    };

    const service = new AutomatedSitemapGeneratorService(mockDataSource, {
      baseUrl,
    });

    const result = await service.generateSitemap();

    expect(result.isIndex).toBe(false);
    expect(result.totalUrls).toBe(2);
    expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result.xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(result.xml).toContain("<loc>https://qooqnos.com/fa/product/");
    expect(result.xml).toContain("<loc>https://qooqnos.com/fa/business/");
    expect(result.xml).toContain("<lastmod>2026-03-01T00:00:00.000Z</lastmod>");
  });

  it("automatically generates a sitemap index and shards when url count exceeds limit", async () => {
    // Shard threshold set low to 2 for testing
    const mockDataSource: SitemapCrawlerDataSource = {
      async getCatalogProducts() {
        return [
          { id: "p1", name: "محصول ۱", status: "active", updatedAt: "2026-01-01T00:00:00Z" },
          { id: "p2", name: "محصول ۲", status: "active", updatedAt: "2026-01-02T00:00:00Z" },
          { id: "p3", name: "محصول ۳", status: "active", updatedAt: "2026-01-03T00:00:00Z" },
        ];
      },
    };

    const service = new AutomatedSitemapGeneratorService(mockDataSource, {
      baseUrl,
      maxUrlsPerSitemap: 2,
    });

    const result = await service.generateSitemap();

    expect(result.isIndex).toBe(true);
    expect(result.totalUrls).toBe(3);
    expect(result.shards?.length).toBe(2);
    expect(result.xml).toContain("<sitemapindex");
    expect(result.xml).toContain("<loc>https://qooqnos.com/sitemap-1.xml</loc>");
    expect(result.xml).toContain("<loc>https://qooqnos.com/sitemap-2.xml</loc>");
    expect(result.shards?.[0]?.count).toBe(2);
    expect(result.shards?.[1]?.count).toBe(1);
  });
});
