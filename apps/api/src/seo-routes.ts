import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";
import { buildRobotsTxt, buildSitemapIndexXml, buildSitemapXml, SITEMAP_URL_LIMIT } from "@qooqnos/seo";
import { crawlStoredSeoRepresentation } from "./seo-production-crawler";

export function registerSeoRoutes(router: ApiRouter, database: D1Database | undefined, canonicalBaseUrl = "https://qooqnos.com"): void {
  router.register({
    method: "GET",
    path: "/sitemap.xml",
    module: "seo",
    operation: "sitemap.read",
    handler: async () => {
      if (!database) return new Response("Database is not configured.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      const canonicalPrefix = canonicalBaseUrl.replace(/\/$/, "") + "/";
      const countRow = await database.first<{ total: number }>(
        `SELECT COUNT(DISTINCT canonical_url) AS total
           FROM seo_entity_representations
          WHERE indexability='index' AND publication_state='published' AND visibility='public' AND canonical_url LIKE ?`,
        canonicalPrefix + "%",
      );
      const total = countRow?.total ?? 0;
      const shardCount = Math.max(1, Math.ceil(total / SITEMAP_URL_LIMIT));
      const xml = total > SITEMAP_URL_LIMIT
        ? buildSitemapIndexXml(Array.from({ length: shardCount }, (_, index) => canonicalBaseUrl.replace(/\/$/, "") + "/sitemap-" + (index + 1) + ".xml"))
        : buildSitemapXml(await readSitemapShardRows(database, canonicalPrefix, 0));
      return new Response(xml, { status: 200, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=300" } });
    },
  });

  router.register({
    method: "GET",
    path: "/sitemap-:shard.xml",
    module: "seo",
    operation: "sitemap.shard.read",
    handler: async ({ params }) => {
      if (!database) return new Response("Database is not configured.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      const shard = Number(params.shard);
      if (!Number.isSafeInteger(shard) || shard < 1) return new Response("Sitemap shard not found.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" } });
      const canonicalPrefix = canonicalBaseUrl.replace(/\/$/, "") + "/";
      const countRow = await database.first<{ total: number }>(
        `SELECT COUNT(DISTINCT canonical_url) AS total
           FROM seo_entity_representations
          WHERE indexability='index' AND publication_state='published' AND visibility='public' AND canonical_url LIKE ?`,
        canonicalPrefix + "%",
      );
      const total = countRow?.total ?? 0;
      const shardCount = Math.max(1, Math.ceil(total / SITEMAP_URL_LIMIT));
      if (shard > shardCount) return new Response("Sitemap shard not found.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" } });
      const xml = buildSitemapXml(await readSitemapShardRows(database, canonicalPrefix, (shard - 1) * SITEMAP_URL_LIMIT));
      return new Response(xml, { status: 200, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=300" } });
    },
  });

  router.register({
    method: "GET",
    path: "/robots.txt",
    module: "seo",
    operation: "robots.read",
    handler: ({ context }) => {
      const origin = canonicalBaseUrl.replace(/\\/$/, "");
      return new Response(buildRobotsTxt(`${origin}/sitemap.xml`), { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/seo/audit/:entityId",
    module: "seo",
    operation: "audit.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const audit = await new (await import("@qooqnos/seo")).SeoRepository(database).getLatestAudit(context, params.entityId);
      return audit ? json({ audit }, 200, context.requestId) : json({ error: { code: "NOT_FOUND", message: "SEO audit not found." } }, 404, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/audit/:entityId",
    module: "seo",
    operation: "audit.run",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params, request }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const repository = new (await import("@qooqnos/seo")).SeoRepository(database);
      const locale = new URL(request.url).searchParams.get("locale") ?? undefined;
      const representation = await repository.getRepresentation(context, params.entityId, locale);
      if (!representation) return json({ error: { code: "NOT_FOUND", message: "SEO representation not found." } }, 404, context.requestId);
      const now = new Date().toISOString();
      await repository.saveAudit(context, {
        id: `seo-audit:${params.entityId}:${crypto.randomUUID()}`,
        entity: representation.entity,
        canonicalUrl: representation.canonicalUrl,
        indexability: representation.indexability,
        now,
        surface: {
          ...(representation.metadata ? { metadata: representation.metadata } : {}),
          ...(representation.structuredData ? { structuredData: representation.structuredData } : {}),
          ...(representation.answer ? { answer: representation.answer } : {}),
          ...(representation.page ? { page: representation.page } : {}),
          ...(representation.policy ? { policy: representation.policy } : {}),
          now,
        },
      });
      return json({ audit: await repository.getLatestAudit(context, params.entityId) }, 200, context.requestId);
    },
  });


  router.register({
    method: "POST",
    path: "/api/v1/seo/crawl/:entityId",
    module: "seo",
    operation: "crawl.run",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params, request }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const repository = new (await import("@qooqnos/seo")).SeoRepository(database);
      const locale = new URL(request.url).searchParams.get("locale") ?? undefined;
      const representation = await repository.getRepresentation(context, params.entityId, locale);
      if (!representation) return json({ error: { code: "NOT_FOUND", message: "SEO representation not found." } }, 404, context.requestId);
      const scope = context.tenantId;
      const workspaceId = context.workspaceId ?? null;
      const row = {
        organizationId: scope,
        workspaceId,
        entityId: params.entityId,
        canonicalUrl: representation.canonicalUrl,
        representationJson: JSON.stringify({
          entity: representation.entity,
          ...(representation.metadata ? { metadata: representation.metadata } : {}),
          ...(representation.structuredData ? { structuredData: representation.structuredData } : {}),
          ...(representation.answer ? { answer: representation.answer } : {}),
          ...(representation.page ? { page: representation.page } : {}),
        }),
      };
      const result = await crawlStoredSeoRepresentation(database, row, new Date().toISOString(), fetch, canonicalBaseUrl);
      return json({ crawl: result }, result.errors.length ? 502 : 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/seo/health",
    module: "seo",
    operation: "health.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const result = await database.first<{ pending: number; failed: number }>(
        `SELECT
           SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed
         FROM seo_publication_jobs WHERE organization_id=? AND workspace_id IS ?`,
        context.tenantId, context.workspaceId ?? null,
      );
      const recentSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const crawl = await database.first<{ failures: number; lastObservedAt: string | null }>(
        `SELECT
           SUM(CASE WHEN metric='render-errors' AND value_numeric > 0 THEN 1 ELSE 0 END) AS failures,
           MAX(observed_at) AS lastObservedAt
         FROM seo_measurements
         WHERE organization_id=? AND workspace_id IS ? AND surface='production-crawler' AND observed_at>=?`,
        context.tenantId, context.workspaceId ?? null, recentSince,
      );
      const measurement = await database.first<{ failures: number; lastObservedAt: string | null; runs: number }>(
        `SELECT
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failures,
           MAX(completed_at) AS lastObservedAt,
           COUNT(*) AS runs
         FROM seo_measurement_runs
         WHERE organization_id=? AND workspace_id IS ? AND started_at>=?`,
        context.tenantId, context.workspaceId ?? null, recentSince,
      );
      const degraded = (result?.failed ?? 0) > 0 || (crawl?.failures ?? 0) > 0 || (measurement?.failures ?? 0) > 0;
      return json({
        status: degraded ? "degraded" : "ok",
        publication: { pending: result?.pending ?? 0, failed: result?.failed ?? 0 },
        productionCrawler: { recentFailures: crawl?.failures ?? 0, lastObservedAt: crawl?.lastObservedAt ?? null },
        visibilityMeasurement: { recentFailures: measurement?.failures ?? 0, runs: measurement?.runs ?? 0, lastObservedAt: measurement?.lastObservedAt ?? null },
      }, degraded ? 503 : 200, context.requestId);
    },
  });
}

async function readSitemapShardRows(database: D1Database, canonicalPrefix: string, offset: number): Promise<readonly { url: string; lastmod?: string }[]> {
  const rows = await database.all<{ canonicalUrl: string; lastmod: string | null }>(
    `SELECT canonical_url AS canonicalUrl, MAX(generated_at) AS lastmod
       FROM seo_entity_representations
      WHERE indexability='index' AND publication_state='published' AND visibility='public' AND canonical_url LIKE ?
      GROUP BY canonical_url
      ORDER BY canonical_url ASC
      LIMIT ? OFFSET ?`,
    canonicalPrefix + "%", SITEMAP_URL_LIMIT, offset,
  );
  return rows.map((row) => ({ url: row.canonicalUrl, ...(row.lastmod ? { lastmod: row.lastmod } : {}) }));
}
