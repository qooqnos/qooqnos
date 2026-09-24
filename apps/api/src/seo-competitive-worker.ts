import type { D1Database } from "@qooqnos/database";
import type { RequestContext } from "@qooqnos/core";
import {
  DataForSeoGoogleCompetitiveProvider,
  SeoCompetitiveRepository,
  type CompetitiveQuery,
  type DataForSeoCompetitiveConfig,
} from "@qooqnos/seo";

interface CompetitiveQueryRow {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string | null;
  readonly queryText: string;
  readonly locale: string;
  readonly entityId: string | null;
  readonly entityType: string | null;
}

export interface SeoCompetitiveWorkerConfig {
  readonly login: string;
  readonly password: string;
  readonly endpoint?: string;
  readonly locationCode?: number;
  readonly locationName?: string;
  readonly languageCode: string;
  readonly device?: "desktop" | "mobile";
  readonly depth?: number;
  readonly limit?: number;
  readonly organizationId?: string;
  readonly workspaceId?: string | null;
  readonly entityId?: string;
  readonly queryText?: string;
}

export interface SeoCompetitiveWorkerResult {
  readonly queries: number;
  readonly runs: number;
  readonly observations: number;
  readonly discoveredCompetitors: number;
  readonly changes: number;
  readonly failures: number;
}

export async function runSeoCompetitiveIntelligence(
  database: D1Database,
  config: SeoCompetitiveWorkerConfig,
  canonicalBaseUrl: string,
  now: string,
): Promise<SeoCompetitiveWorkerResult> {
  const provider = new DataForSeoGoogleCompetitiveProvider({
    login: config.login,
    password: config.password,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
  } satisfies DataForSeoCompetitiveConfig);

  const rows = await selectQueries(database, config);
  const ownOrigin = new URL(canonicalBaseUrl).origin;
  const repository = new SeoCompetitiveRepository(database);
  let runs = 0;
  let observations = 0;
  let discoveredCompetitors = 0;
  let changes = 0;
  let failures = 0;

  for (const row of rows) {
    const context = workerContext(row.organizationId, row.workspaceId);
    const runId = "seo-competitive:" + row.id + ":" + crypto.randomUUID();
    runs += 1;
    const depth = Math.min(Math.max(Math.trunc(config.depth ?? 20), 10), 100);
    await repository.createRun(context, {
      id: runId,
      providerId: provider.id,
      queryId: row.id,
      queryText: row.queryText,
      locale: row.locale,
      locationContext: config.locationName ?? String(config.locationCode ?? ""),
      device: config.device ?? "desktop",
      depth,
      startedAt: now,
      provenance: { provider: provider.id, locationName: config.locationName ?? null, locationCode: config.locationCode ?? null, languageCode: config.languageCode, device: config.device ?? "desktop", depth },
    });

    try {
      const query: CompetitiveQuery = {
        queryText: row.queryText,
        locale: row.locale,
        ...(config.locationName ? { locationName: config.locationName } : {}),
        ...(config.locationCode ? { locationCode: config.locationCode } : {}),
        languageCode: config.languageCode,
        device: config.device ?? "desktop",
        depth,
      };
      const result = await provider.observe(query);
      const citationUrls = new Set(result.aiCitations.map((item) => normalizeUrl(item.url)));
      let runObservationCount = 0;

      for (const item of result.results) {
        if (!item.url || !item.domain) continue;
        const isOwn = sameOrigin(item.url, ownOrigin);
        let competitorId: string | undefined;
        if (!isOwn) {
          competitorId = await repository.upsertCompetitor(context, {
            domain: item.domain,
            ...(item.title ? { displayName: item.title } : {}),
            now,
            provenance: result.provenance,
          });
          discoveredCompetitors += 1;
        }
        await repository.recordObservation(context, {
          id: runId + ":" + crypto.randomUUID(),
          runId,
          ...(competitorId ? { competitorId } : {}),
          ...(isOwn && row.entityId ? { entityId: row.entityId } : {}),
          queryText: row.queryText,
          resultType: item.type,
          domain: item.domain,
          resultUrl: item.url,
          ...(item.title ? { title: item.title } : {}),
          ...(item.snippet ? { snippet: item.snippet } : {}),
          ...(item.rankGroup !== undefined ? { rankGroup: item.rankGroup } : {}),
          ...(item.rankAbsolute !== undefined ? { rankAbsolute: item.rankAbsolute } : {}),
          aiCitation: citationUrls.has(normalizeUrl(item.url)),
          observedAt: now,
          provenance: result.provenance,
        });
        await repository.detectChanges(context, {
          queryText: row.queryText,
          currentRunId: runId,
          ...(competitorId ? { competitorId } : {}),
          domain: item.domain,
          currentUrl: item.url,
          ...(item.rankAbsolute !== undefined ? { currentRank: item.rankAbsolute } : {}),
          currentAiCitation: citationUrls.has(normalizeUrl(item.url)),
          observationType: "serp",
          detectedAt: now,
          provenance: result.provenance,
        });
        observations += 1;
        runObservationCount += 1;
      }

      const previousDomains = await previousDomainsForQuery(database, row, runId);
      const currentDomains = new Set(
        result.results.filter((item) => item.domain && !sameOrigin(item.url ?? "", ownOrigin)).map((item) => item.domain!),
      );
      for (const previous of previousDomains) {
        if (!currentDomains.has(previous.domain)) {
          await repository.recordChange(context, {
            queryText: row.queryText,
            competitorId: previous.competitorId ?? undefined,
            changeType: "lost-entry",
            previousRank: previous.rankAbsolute ?? undefined,
            previousUrl: previous.resultUrl,
            detectedAt: now,
            provenance: { ...result.provenance, previousObservedAt: previous.observedAt },
          });
          changes += 1;
        }
      }

      for (const citation of result.aiCitations) {
        const domain = citation.domain ?? normalizeDomainSafe(citation.url);
        if (sameOrigin(citation.url, ownOrigin)) continue;
        const competitorId = await repository.upsertCompetitor(context, {
          domain,
          ...(citation.title ? { displayName: citation.title } : {}),
          now,
          provenance: result.provenance,
        });
        await repository.recordObservation(context, {
          id: runId + ":ai:" + crypto.randomUUID(),
          runId,
          competitorId,
          queryText: row.queryText,
          resultType: "ai_citation",
          domain,
          resultUrl: citation.url,
          ...(citation.title ? { title: citation.title } : {}),
          aiCitation: true,
          observedAt: now,
          provenance: { ...result.provenance, citationPosition: citation.position },
        });
        await repository.detectChanges(context, {
          queryText: row.queryText,
          currentRunId: runId,
          competitorId,
          domain,
          currentUrl: citation.url,
          currentAiCitation: true,
          observationType: "ai_citation",
          detectedAt: now,
          provenance: { ...result.provenance, citationPosition: citation.position },
        });
        observations += 1;
        runObservationCount += 1;
      }

      await repository.completeRun(context, {
        id: runId,
        status: "succeeded",
        completedAt: now,
        resultCount: runObservationCount,
      });
    } catch (error) {
      failures += 1;
      await repository.completeRun(context, {
        id: runId,
        status: "failed",
        completedAt: now,
        resultCount: 0,
        errorText: error instanceof Error ? error.message : "Competitive intelligence run failed.",
      });
    }
  }

  return { queries: rows.length, runs, observations, discoveredCompetitors, changes, failures };
}

async function selectQueries(database: D1Database, config: SeoCompetitiveWorkerConfig): Promise<readonly CompetitiveQueryRow[]> {
  const limit = Math.min(Math.max(Math.trunc(config.limit ?? 10), 1), 50);
  const filters: string[] = ["q.lifecycle_state='active'"];
  const params: unknown[] = [];
  if (config.organizationId) { filters.push("q.organization_id=?"); params.push(config.organizationId); }
  if (config.workspaceId !== undefined) { filters.push("q.workspace_id IS ?"); params.push(config.workspaceId); }
  if (config.entityId) { filters.push("q.entity_id=?"); params.push(config.entityId); }
  if (config.queryText) { filters.push("q.query_text=?"); params.push(config.queryText); }
  params.push(limit);
  return database.all<CompetitiveQueryRow>(
    `SELECT q.id AS id,
            q.organization_id AS organizationId,
            q.workspace_id AS workspaceId,
            q.query_text AS queryText,
            q.locale AS locale,
            q.entity_id AS entityId,
            q.entity_type AS entityType
       FROM seo_queries q
       LEFT JOIN (
         SELECT organization_id, workspace_id, query_id, MAX(started_at) AS lastRunAt
           FROM seo_competitive_runs
          GROUP BY organization_id, workspace_id, query_id
       ) r
         ON r.organization_id=q.organization_id
        AND r.workspace_id IS q.workspace_id
        AND r.query_id=q.id
      WHERE ${filters.join(" AND ")}
      ORDER BY CASE WHEN r.lastRunAt IS NULL THEN 0 ELSE 1 END,
               r.lastRunAt ASC,
               q.updated_at DESC
      LIMIT ?`,
    ...params,
  );
}

async function previousDomainsForQuery(
  database: D1Database,
  row: CompetitiveQueryRow,
  runId: string,
): Promise<readonly { domain: string; competitorId: string | null; rankAbsolute: number | null; resultUrl: string; observedAt: string }[]> {
  return database.all(
    `SELECT domain, competitor_id AS competitorId, rank_absolute AS rankAbsolute, result_url AS resultUrl, observed_at AS observedAt
       FROM seo_competitive_observations
      WHERE organization_id=? AND workspace_id IS ? AND query_text=? AND run_id<>?
        AND result_type<>'ai_citation'
        AND competitor_id IS NOT NULL
      ORDER BY observed_at DESC`,
    row.organizationId, row.workspaceId, row.queryText, runId,
  );
}

function sameOrigin(value: string, origin: string): boolean {
  try { return new URL(value).origin === origin; } catch { return false; }
}

function normalizeDomainSafe(value: string): string {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return value.toLowerCase(); }
}

function normalizeUrl(value: string): string {
  try { const u = new URL(value); return u.origin + u.pathname.replace(/\/+$/, ""); } catch { return value; }
}

function workerContext(organizationId: string, workspaceId: string | null): RequestContext {
  const requestId = "seo-competitive-worker:" + crypto.randomUUID();
  return {
    tenantId: organizationId,
    workspaceId: workspaceId ?? undefined,
    authenticated: true,
    actorId: "system:seo-competitive-worker",
    module: "seo",
    operation: "seo.competitive.measure",
    requestId,
    correlationId: requestId,
  } as RequestContext;
}
