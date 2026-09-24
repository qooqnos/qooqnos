import type { D1Database } from '@qooqnos/database';
import type { RequestContext } from '@qooqnos/core';
import { crawlProductionSeoPage, SeoObservabilityRepository, type SeoCrawlerResult } from '@qooqnos/seo';
import type { SeoEntity, SeoMetadata, StructuredData, AnswerRepresentation, EntityPageModel } from '@qooqnos/seo';

interface StoredCrawlerRow { organizationId: string; workspaceId: string | null; entityId: string; canonicalUrl: string; representationJson: string; }

export interface ProductionCrawlerRunResult { crawled: number; passed: number; failed: number; warnings: number; }

export async function crawlStoredSeoRepresentation(
  database: D1Database,
  representation: { organizationId: string; workspaceId: string | null; entityId: string; canonicalUrl: string; representationJson: string },
  now: string,
  fetcher: typeof fetch = fetch,
  canonicalBaseUrl = "https://qooqnos.com",
): Promise<SeoCrawlerResult> {
  const requestedOrigin = new URL(representation.canonicalUrl).origin;
  const allowedOrigin = new URL(canonicalBaseUrl).origin;
  if (requestedOrigin !== allowedOrigin) throw new Error(`SEO crawler refused non-canonical origin: ${requestedOrigin}`);
  const parsed = JSON.parse(representation.representationJson) as { entity?: SeoEntity; metadata?: SeoMetadata; structuredData?: StructuredData; answer?: AnswerRepresentation; page?: EntityPageModel };
  if (!parsed.entity || !parsed.metadata || !parsed.structuredData || !parsed.answer || !parsed.page) throw new Error('Stored SEO representation is incomplete for production crawling.');
  const result = await crawlProductionSeoPage({ canonicalUrl: representation.canonicalUrl, metadata: parsed.metadata, structuredData: parsed.structuredData, answer: parsed.answer, page: parsed.page, entity: parsed.entity }, fetcher);
  const context = crawlerContext(representation.organizationId, representation.workspaceId);
  const observability = new SeoObservabilityRepository(database);
  await observability.record(context, {
    id: 'seo-crawl:' + representation.entityId + ':' + crypto.randomUUID(),
    surface: 'production-crawler',
    metric: 'render-errors',
    entityId: representation.entityId,
    numericValue: result.errors.length,
    ...(result.errors.length ? { textValue: result.errors.join(' | ') } : {}),
    provenance: { url: result.url, finalUrl: result.finalUrl, status: result.status, renderMode: result.renderMode, warnings: result.warnings },
    observedAt: now,
  });
  await observability.record(context, {
    id: 'seo-crawl-status:' + representation.entityId + ':' + crypto.randomUUID(),
    surface: 'production-crawler',
    metric: 'render-status',
    entityId: representation.entityId,
    numericValue: result.status,
    textValue: result.renderMode,
    provenance: { url: result.url, finalUrl: result.finalUrl, contentType: result.contentType, indexable: result.indexable },
    observedAt: now,
  });
  await observability.record(context, {
    id: 'seo-crawl-warnings:' + representation.entityId + ':' + crypto.randomUUID(),
    surface: 'production-crawler',
    metric: 'render-warnings',
    entityId: representation.entityId,
    numericValue: result.warnings.length,
    textValue: result.warnings.join(' | ') || undefined,
    provenance: { url: result.url },
    observedAt: now,
  });
  return result;
}

export async function runProductionSeoCrawler(database: D1Database, canonicalBaseUrl: string, limit: number, now: string, fetcher: typeof fetch = fetch): Promise<ProductionCrawlerRunResult> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const rows = await database.all<StoredCrawlerRow>(
    `SELECT organization_id AS organizationId, workspace_id AS workspaceId, entity_id AS entityId, canonical_url AS canonicalUrl, representation_json AS representationJson
       FROM seo_entity_representations
      WHERE indexability='index' AND publication_state='published' AND visibility='public'
      ORDER BY generated_at DESC, canonical_url ASC LIMIT ?`,
    safeLimit,
  );
  let passed = 0; let failed = 0; let warnings = 0;
  for (const row of rows) {
    const url = new URL(row.canonicalUrl);
    if (url.protocol !== 'https:') continue;
    try {
      const result = await crawlStoredSeoRepresentation(database, row, now, fetcher, canonicalBaseUrl);
      if (result.errors.length === 0) passed += 1; else failed += 1;
      warnings += result.warnings.length;
    } catch { failed += 1; }
  }
  return { crawled: rows.length, passed, failed, warnings };
}

function crawlerContext(organizationId: string, workspaceId: string | null): RequestContext {
  const requestId = 'seo-crawler:' + crypto.randomUUID();
  return { tenantId: organizationId, workspaceId: workspaceId ?? undefined, authenticated: true, actorId: 'system:seo-crawler', module: 'seo', operation: 'seo.crawler.production', requestId, correlationId: requestId } as RequestContext;
}
