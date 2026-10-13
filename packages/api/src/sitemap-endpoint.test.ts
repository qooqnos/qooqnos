import { describe, it, expect } from "vitest";
import { handleSitemapRequest } from "./sitemap-endpoint";
import type { D1Database } from "@qooqnos/database";

describe("Sitemap Endpoint (packages/api/src/sitemap-endpoint.ts)", () => {
  it("returns 503 when database is not provided", async () => {
    const res = await handleSitemapRequest(undefined);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).toContain("Database is not configured.");
  });

  it("serves dynamically generated sitemap XML with 200 and XML headers", async () => {
    const mockDb = {
      async all(query: string) {
        if (query.includes("businesses")) {
          return [
            {
              id: "biz-1",
              name: "فروشگاه نمونه",
              displayName: "فروشگاه نمونه",
              status: "active",
              publicationStatus: "published",
              defaultLocale: "fa",
              updatedAt: "2026-06-01T00:00:00Z",
            },
          ];
        }
        if (query.includes("products")) {
          return [
            {
              id: "prod-1",
              name: "محصول آزمایشی",
              status: "active",
              updatedAt: "2026-06-01T00:00:00Z",
            },
          ];
        }
        return [];
      },
    } as unknown as D1Database;

    const res = await handleSitemapRequest(mockDb, {
      baseUrl: "https://qooqnos.com",
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const xml = await res.text();
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("https://qooqnos.com/sitemap-business.xml");
    expect(xml).toContain("https://qooqnos.com/sitemap-products.xml");
  });
});
