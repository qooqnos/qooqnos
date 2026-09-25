import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";
import { buildRobotsTxt, buildSitemapIndexXml, buildSitemapXml, buildImageSitemapXml, buildMerchantProductFeedXml, projectMerchantProductFeed, SITEMAP_URL_LIMIT, type RobotsAiPolicy, SeoObservabilityRepository, parseGoogleSearchConsoleExport, parseBingAiPerformanceExport } from "@qooqnos/seo";
import { crawlStoredSeoRepresentation } from "./seo-production-crawler";
import { evaluateSeoProductionReadiness } from "./seo-production-readiness";
import type { ApiEnv } from "./env";

export function registerSeoRoutes(router: ApiRouter, database: D1Database | undefined, canonicalBaseUrl = "https://qooqnos.com", environment?: ApiEnv): void {
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
    path: "/image-sitemap.xml",
    module: "seo",
    operation: "image-sitemap.read",
    handler: async () => {
      if (!database) return new Response("Database is not configured.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      const canonicalPrefix = canonicalBaseUrl.replace(/\/$/, "") + "/";
      const rows = await database.all<{ canonicalUrl: string; representationJson: string; generatedAt: string }>(
        "SELECT canonical_url AS canonicalUrl, representation_json AS representationJson, generated_at AS generatedAt FROM seo_entity_representations WHERE indexability='index' AND publication_state='published' AND visibility='public' AND canonical_url LIKE ? ORDER BY canonical_url ASC LIMIT ?",
        canonicalPrefix + "%", SITEMAP_URL_LIMIT,
      );
      const entries: { url: string; images: string[]; lastmod: string }[] = [];
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.representationJson) as { entity?: { imageUrl?: string } };
          const image = parsed.entity?.imageUrl;
          if (typeof image === "string" && image.trim()) entries.push({ url: row.canonicalUrl, images: [image], lastmod: row.generatedAt });
        } catch {}
      }
      const xml = buildImageSitemapXml(entries);
      return new Response(xml, { status: 200, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=300" } });
    },
  });
  router.register({
    method: "GET",
    path: "/merchant-center/products.xml",
    module: "seo",
    operation: "merchant-feed.read",
    handler: async () => {
      if (!database) return new Response("Database is not configured.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      const canonicalPrefix = canonicalBaseUrl.replace(/\\/$/, "") + "/";
      const limitValue = Number(environment?.SEO_MERCHANT_FEED_LIMIT ?? "50000");
      const limit = Number.isFinite(limitValue) ? Math.min(Math.max(Math.trunc(limitValue), 1), 50000) : 50000;
      const rows = await database.all<{ representationJson: string }>(
        `SELECT representation_json AS representationJson
           FROM seo_entity_representations
          WHERE entity_type='Product'
            AND indexability='index'
            AND publication_state='published'
            AND visibility='public'
            AND canonical_url LIKE ?
          ORDER BY canonical_url ASC
          LIMIT ?`,
        canonicalPrefix + "%", limit,
      );
      const entities = rows.flatMap((row) => {
        try {
          const parsed = JSON.parse(row.representationJson) as { entity?: import("@qooqnos/seo").SeoEntity };
          return parsed.entity ? [parsed.entity] : [];
        } catch {
          return [];
        }
      });
      const projection = projectMerchantProductFeed(entities, { canonicalBaseUrl });
      const xml = buildMerchantProductFeedXml(projection.items);
      return new Response(xml, {
        status: 200,
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=900, s-maxage=900",
          "x-phoenix-merchant-feed-items": String(projection.items.length),
          "x-phoenix-merchant-feed-skipped": String(projection.skipped.length),
        },
      });
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/visibility/import/google-search-console",
    module: "seo",
    operation: "visibility.import.google_search_console",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const report = body.report === "generative-ai" ? "generative-ai" : body.report === "multimodal" ? "multimodal" : null;
      if (!report) return json({ error: { code: "VALIDATION_ERROR", message: "report must be multimodal or generative-ai." } }, 400, context.requestId);
      const locale = typeof body.locale === "string" && body.locale.trim() ? body.locale.trim() : "en-US";
      const source = typeof body.content === "string" ? body.content : Array.isArray(body.rows) ? body.rows.filter((row) => row && typeof row === "object" && !Array.isArray(row)) as Record<string, unknown>[] : null;
      if (!source) return json({ error: { code: "VALIDATION_ERROR", message: "Provide CSV/JSON content or rows." } }, 400, context.requestId);
      const observations = parseGoogleSearchConsoleExport(source, {
        report, locale,
        ...(typeof body.entityId === "string" ? { entityId: body.entityId } : {}),
        ...(typeof body.entityType === "string" ? { entityType: body.entityType } : {}),
        ...(typeof body.canonicalUrl === "string" ? { canonicalUrl: body.canonicalUrl } : {}),
        ...(typeof body.exportReference === "string" ? { exportReference: body.exportReference } : {}),
      });
      return recordImportedVisibility(database, context, observations, "google-search-console-export", report, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/visibility/import/bing-ai-performance",
    module: "seo",
    operation: "visibility.import.bing_ai_performance",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const datasets = new Set(["pages", "grounding-queries", "timeseries"]);
      const dataset = typeof body.dataset === "string" && datasets.has(body.dataset) ? body.dataset as "pages" | "grounding-queries" | "timeseries" : null;
      if (!dataset) return json({ error: { code: "VALIDATION_ERROR", message: "dataset must be pages, grounding-queries, or timeseries." } }, 400, context.requestId);
      const locale = typeof body.locale === "string" && body.locale.trim() ? body.locale.trim() : "en-US";
      const source = typeof body.content === "string" ? body.content : Array.isArray(body.rows) ? body.rows.filter((row) => row && typeof row === "object" && !Array.isArray(row)) as Record<string, unknown>[] : null;
      if (!source) return json({ error: { code: "VALIDATION_ERROR", message: "Provide CSV/JSON content or rows." } }, 400, context.requestId);
      const observations = parseBingAiPerformanceExport(source, {
        dataset, locale,
        ...(typeof body.entityId === "string" ? { entityId: body.entityId } : {}),
        ...(typeof body.entityType === "string" ? { entityType: body.entityType } : {}),
        ...(typeof body.exportReference === "string" ? { exportReference: body.exportReference } : {}),
      });
      return recordImportedVisibility(database, context, observations, "bing-ai-performance-export", dataset, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/robots.txt",
    module: "seo",
    operation: "robots.read",
    handler: () => {
      const origin = canonicalBaseUrl.replace(/\/$/, "");
      return new Response(buildRobotsTxt(`${origin}/sitemap.xml`, undefined, buildRobotsAiPolicy(environment)), { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
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
    path: "/api/v1/seo/visibility/:entityId",
    module: "seo",
    operation: "visibility.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const rows = await database.all(
        `SELECT id, observed_at AS observedAt, surface, metric, query_class AS queryClass,
                value_numeric AS valueNumeric, value_text AS valueText, provenance_json AS provenanceJson
           FROM seo_measurements
          WHERE organization_id=? AND workspace_id IS ? AND entity_id=?
          ORDER BY observed_at DESC
          LIMIT 200`,
        context.tenantId, context.workspaceId ?? null, params.entityId,
      );
      const citations = await database.all(
        `SELECT id, run_id AS runId, citation_url AS citationUrl, citation_title AS citationTitle,
                citation_position AS citationPosition, citation_count AS citationCount,
                source_type AS sourceType, observed_at AS observedAt, provenance_json AS provenanceJson
           FROM seo_measurement_citations
          WHERE organization_id=? AND workspace_id IS ? AND entity_id=?
          ORDER BY observed_at DESC
          LIMIT 100`,
        context.tenantId, context.workspaceId ?? null, params.entityId,
      );
      return json({
        visibility: {
          measurements: rows.map((row) => ({
            ...row,
            provenance: JSON.parse(String(row.provenanceJson)),
          })),
          citations: citations.map((row) => ({
            ...row,
            provenance: JSON.parse(String(row.provenanceJson)),
          })),
        },
      }, 200, context.requestId);
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
      const competitive = await database.first<{ failures: number; runs: number; lastObservedAt: string | null; competitors: number }>(
        `SELECT
           (SELECT SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END)
              FROM seo_competitive_runs
             WHERE organization_id=? AND workspace_id IS ? AND started_at>=?) AS failures,
           (SELECT COUNT(*)
              FROM seo_competitive_runs
             WHERE organization_id=? AND workspace_id IS ? AND started_at>=?) AS runs,
           (SELECT MAX(completed_at)
              FROM seo_competitive_runs
             WHERE organization_id=? AND workspace_id IS ?) AS lastObservedAt,
           (SELECT COUNT(*)
              FROM seo_competitors
             WHERE organization_id=? AND workspace_id IS ? AND lifecycle_state='active') AS competitors`,
        context.tenantId, context.workspaceId ?? null, recentSince,
        context.tenantId, context.workspaceId ?? null, recentSince,
        context.tenantId, context.workspaceId ?? null,
        context.tenantId, context.workspaceId ?? null,
      );
      const readiness = evaluateSeoProductionReadiness(environment ?? { SEO_CANONICAL_BASE_URL: canonicalBaseUrl });
      const degraded = (result?.failed ?? 0) > 0 || (crawl?.failures ?? 0) > 0 || (measurement?.failures ?? 0) > 0 || (competitive?.failures ?? 0) > 0;
      return json({
        status: degraded ? "degraded" : readiness.state,
        publication: { pending: result?.pending ?? 0, failed: result?.failed ?? 0 },
        productionCrawler: { recentFailures: crawl?.failures ?? 0, lastObservedAt: crawl?.lastObservedAt ?? null },
        visibilityMeasurement: { recentFailures: measurement?.failures ?? 0, runs: measurement?.runs ?? 0, lastObservedAt: measurement?.lastObservedAt ?? null },
        competitiveIntelligence: { recentFailures: competitive?.failures ?? 0, runs: competitive?.runs ?? 0, activeCompetitors: competitive?.competitors ?? 0, lastObservedAt: competitive?.lastObservedAt ?? null },
        productionReadiness: readiness,
      }, degraded || readiness.state === "invalid" ? 503 : 200, context.requestId);
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


function buildRobotsAiPolicy(environment?: ApiEnv): RobotsAiPolicy {
  if (!environment) return {};
  const boolean = (value: string | undefined): boolean | undefined => {
    if (value === undefined) return undefined;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
    return undefined;
  };
  const delay = Number(environment.SEO_CRAWL_DELAY_SECONDS);
  return {
    ...(boolean(environment.SEO_ALLOW_OAI_SEARCHBOT) !== undefined ? { oaiSearchBot: boolean(environment.SEO_ALLOW_OAI_SEARCHBOT) } : {}),
    ...(boolean(environment.SEO_ALLOW_GPTBOT) !== undefined ? { gptBot: boolean(environment.SEO_ALLOW_GPTBOT) } : {}),
    ...(boolean(environment.SEO_ALLOW_GOOGLE_EXTENDED) !== undefined ? { googleExtended: boolean(environment.SEO_ALLOW_GOOGLE_EXTENDED) } : {}),
    ...(boolean(environment.SEO_ALLOW_CLAUDEBOT) !== undefined ? { claudeBot: boolean(environment.SEO_ALLOW_CLAUDEBOT) } : {}),
    ...(boolean(environment.SEO_ALLOW_PERPLEXITYBOT) !== undefined ? { perplexityBot: boolean(environment.SEO_ALLOW_PERPLEXITYBOT) } : {}),
    ...(Number.isFinite(delay) && delay >= 0 ? { crawlDelaySeconds: delay } : {}),
  };
}

async function recordImportedVisibility(database: D1Database, context: Parameters<NonNullable<typeof registerSeoRoutes>>[2] extends never ? never : any, observations: readonly import("@qooqnos/seo").ExternalVisibilityObservation[], providerId: string, dataset: string, requestId: string): Promise<Response> {
  const repository = new SeoObservabilityRepository(database);
  const runId = "seo-import:" + providerId + ":" + crypto.randomUUID();
  const queryText = observations.find((item) => item.queryText)?.queryText ?? dataset;
  const locale = observations[0] ? String(observations[0].provenance.locale ?? "en-US") : "en-US";
  await repository.createMeasurementRun(context, {
    id: runId,
    providerId,
    surface: observations.some((item) => item.surface === "ai-answer") ? "ai-answer" : "search-engine",
    queryText,
    locale,
    ...(observations[0]?.entityId ? { entityId: observations[0].entityId } : {}),
    startedAt: new Date().toISOString(),
    provenance: { provider: providerId, dataset, imported: true },
  });
  const now = new Date().toISOString();
  let count = 0;
  for (const item of observations) {
    await repository.record(context, {
      id: runId + ":" + crypto.randomUUID(),
      surface: item.surface,
      metric: item.metric,
      ...(item.entityId ? { entityId: item.entityId } : {}),
      queryClass: "external-export",
      ...(item.numericValue !== undefined ? { numericValue: item.numericValue } : {}),
      ...(item.textValue !== undefined ? { textValue: item.textValue } : {}),
      provenance: { ...item.provenance, importedAt: now },
      observedAt: item.observedAt,
    });
    if (item.citationUrl) {
      await repository.recordMeasurementCitation(context, {
        id: runId + ":citation:" + crypto.randomUUID(),
        runId,
        ...(item.entityId ? { entityId: item.entityId } : {}),
        citationUrl: item.citationUrl,
        ...(item.citationTitle ? { citationTitle: item.citationTitle } : {}),
        ...(item.citationPosition !== undefined ? { citationPosition: item.citationPosition } : {}),
        ...(item.citationCount !== undefined ? { citationCount: item.citationCount } : {}),
        sourceType: item.surface === "ai-answer" ? "ai-answer" : "search-engine",
        observedAt: item.observedAt,
        provenance: { ...item.provenance, importedAt: now },
      });
    }
    count += 1;
  }
  await repository.completeMeasurementRun(context, { id: runId, status: "succeeded", completedAt: now, observationCount: count });
  return json({ imported: count, runId, providerId, dataset }, 200, requestId);
}

