import type { D1Database } from "@qooqnos/database";
import { SeoObservabilityRepository } from "@qooqnos/seo";
import {
  BingWebmasterProvider,
  GoogleSearchConsoleProvider,
  ResponsesWebSearchCitationProvider,
  type SeoMeasurementProvider,
} from "@qooqnos/seo";
import type { RequestContext } from "@qooqnos/core";

interface MeasurementQueryRow {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string | null;
  readonly queryText: string;
  readonly locale: string;
  readonly entityId: string | null;
  readonly entityType: string | null;
  readonly canonicalUrl: string | null;
}

export interface SeoVisibilityWorkerConfig {
  readonly organizationId?: string;
  readonly workspaceId?: string | null;
  readonly entityId?: string;
  readonly queryText?: string;
  readonly google?: {
    readonly siteUrl: string;
    readonly accessToken?: string;
    readonly serviceAccountEmail?: string;
    readonly serviceAccountPrivateKey?: string;
  };
  readonly bing?: { readonly siteUrl: string; readonly apiKey: string };
  readonly ai?: { readonly endpoint: string; readonly apiKey: string; readonly model: string; readonly authMode?: "bearer" | "api-key" };
  readonly limit?: number;
}

export interface SeoVisibilityWorkerResult {
  readonly queries: number;
  readonly providerRuns: number;
  readonly observations: number;
  readonly failures: number;
};

export async function runSeoVisibilityMeasurements(
  database: D1Database,
  config: SeoVisibilityWorkerConfig,
  now: string,
): Promise<SeoVisibilityWorkerResult> {
  const providers = buildProviders(config);
  if (!providers.length) return { queries: 0, providerRuns: 0, observations: 0, failures: 0 };
  const limit = Math.min(Math.max(Math.trunc(config.limit ?? 25), 1), 100);
  const filters: string[] = ["q.lifecycle_state='active'"];
  const params: unknown[] = [];
  if (config.organizationId) { filters.push("q.organization_id=?"); params.push(config.organizationId); }
  if (config.workspaceId !== undefined) { filters.push("q.workspace_id IS ?"); params.push(config.workspaceId); }
  if (config.entityId) { filters.push("q.entity_id=?"); params.push(config.entityId); }
  if (config.queryText) { filters.push("q.query_text=?"); params.push(config.queryText); }
  params.push(limit);
  const rows = await database.all<MeasurementQueryRow>(
    `SELECT q.id AS id,
            q.organization_id AS organizationId,
            q.workspace_id AS workspaceId,
            q.query_text AS queryText,
            q.locale AS locale,
            q.entity_id AS entityId,
            q.entity_type AS entityType,
            r.canonical_url AS canonicalUrl
       FROM seo_queries q
       LEFT JOIN seo_entity_representations r
         ON r.organization_id=q.organization_id
        AND r.workspace_id IS q.workspace_id
        AND r.entity_id=q.entity_id
        AND r.locale=q.locale
        AND r.indexability='index'
        AND r.publication_state='published'
        AND r.visibility='public'
      WHERE ${filters.join(" AND ")}
      ORDER BY q.updated_at DESC
      LIMIT ?`,
    ...params,
  );

  const observationRepository = new SeoObservabilityRepository(database);
  let providerRuns = 0;
  let observations = 0;
  let failures = 0;

  for (const row of rows) {
    const query = {
      id: row.id,
      queryText: row.queryText,
      locale: row.locale,
      ...(row.entityId ? { entityId: row.entityId } : {}),
      ...(row.entityType ? { entityType: row.entityType } : {}),
      ...(row.canonicalUrl ? { canonicalUrl: row.canonicalUrl } : {}),
    };
    const context = workerContext(row.organizationId, row.workspaceId);
    for (const provider of providers) {
      const runId = "seo-measurement:" + provider.id + ":" + row.id + ":" + crypto.randomUUID();
      providerRuns += 1;
      await observationRepository.createMeasurementRun(context, {
        id: runId,
        providerId: provider.id,
        surface: provider.surface,
        queryId: row.id,
        queryText: row.queryText,
        locale: row.locale,
        ...(row.entityId ? { entityId: row.entityId } : {}),
        ...(row.entityType ? { entityType: row.entityType } : {}),
        startedAt: now,
        provenance: { provider: provider.id, surface: provider.surface },
      });
      try {
        const providerObservations = await provider.observe(query);
        for (const item of providerObservations) {
          const provenance = {
            ...item.provenance,
            queryId: row.id,
            locale: row.locale,
            entityType: row.entityType ?? null,
            canonicalUrl: row.canonicalUrl ?? null,
          };
          await observationRepository.record(context, {
            id: runId + ":" + crypto.randomUUID(),
            surface: provider.surface,
            metric: item.metric,
            ...(item.entityId ? { entityId: item.entityId } : {}),
            queryClass: row.queryText,
            ...(item.numericValue !== undefined ? { numericValue: item.numericValue } : {}),
            ...(item.textValue !== undefined ? { textValue: item.textValue } : {}),
            provenance,
            observedAt: now,
          });
          if (item.citationUrl) {
            await observationRepository.recordMeasurementCitation(context, {
              id: runId + ":citation:" + crypto.randomUUID(),
              runId,
              ...(item.entityId ? { entityId: item.entityId } : {}),
              citationUrl: item.citationUrl,
              ...(item.citationTitle ? { citationTitle: item.citationTitle } : {}),
              ...(item.citationPosition !== undefined ? { citationPosition: item.citationPosition } : {}),
              sourceType: item.sourceType,
              observedAt: now,
              provenance,
            });
          }
          observations += 1;
        }
        await observationRepository.completeMeasurementRun(context, {
          id: runId,
          status: "succeeded",
          completedAt: now,
          observationCount: providerObservations.length,
        });
      } catch (error) {
        failures += 1;
        await observationRepository.completeMeasurementRun(context, {
          id: runId,
          status: "failed",
          completedAt: now,
          observationCount: 0,
          errorText: error instanceof Error ? error.message : "SEO visibility measurement failed.",
        });
      }
    }
  }

  return { queries: rows.length, providerRuns, observations, failures };
}

function buildProviders(config: SeoVisibilityWorkerConfig): readonly SeoMeasurementProvider[] {
  const providers: SeoMeasurementProvider[] = [];
  if (config.google) providers.push(new GoogleSearchConsoleProvider(config.google));
  if (config.bing) providers.push(new BingWebmasterProvider(config.bing));
  if (config.ai) providers.push(new ResponsesWebSearchCitationProvider(config.ai));
  return providers;
}

function workerContext(organizationId: string, workspaceId: string | null): RequestContext {
  const requestId = "seo-visibility-worker:" + crypto.randomUUID();
  return {
    tenantId: organizationId,
    workspaceId: workspaceId ?? undefined,
    authenticated: true,
    actorId: "system:seo-visibility-worker",
    module: "seo",
    operation: "seo.visibility.measure",
    requestId,
    correlationId: requestId,
  } as RequestContext;
}
