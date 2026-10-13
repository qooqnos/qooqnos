import type { D1Database } from "@qooqnos/database";
import { generateCatalogSitemapXml, type DynamicSitemapGeneratorOptions } from "@qooqnos/seo";

export interface SitemapHandlerOptions extends Partial<DynamicSitemapGeneratorOptions> {
  readonly baseUrl?: string | undefined;
  readonly defaultLocale?: string | undefined;
}

/**
 * Handles incoming HTTP requests for dynamic sitemap.xml by crawling
 * the catalog, products, and active business listings.
 */
export async function handleSitemapRequest(
  database: D1Database | undefined,
  options: SitemapHandlerOptions = {},
): Promise<Response> {
  if (!database) {
    return new Response("Database is not configured.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const baseUrl = (options.baseUrl ?? "https://qooqnos.com").replace(/\/+$/, "");
  const defaultLocale = options.defaultLocale ?? "fa";

  const result = await generateCatalogSitemapXml(database, {
    baseUrl,
    defaultLocale,
    ...(options.maxUrlsPerShard ? { maxUrlsPerShard: options.maxUrlsPerShard } : {}),
    ...(options.now ? { now: options.now } : {}),
  });

  return new Response(result.xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  });
}
