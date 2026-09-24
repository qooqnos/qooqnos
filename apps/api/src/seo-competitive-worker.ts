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
  readonly pageSampleLimit?: number;
}

export interface SeoCompetitiveWorkerResult {
  readonly queries: number;
  readonly runs: number;
  readonly observations: number;
  readonly discoveredCompetitors: number;
  readonly changes: number;
  readonly failures: number;
  readonly pageSnapshots: number;
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
  const ownDomain = normalizeDomainSafe(canonicalBaseUrl);
  const repository = new SeoCompetitiveRepository(database);
  let runs = 0;
  let observations = 0;
  let discoveredCompetitors = 0;
  let changes = 0;
  let failures = 0;
  let pageSnapshots = 0;
  const discoveredDomainKeys = new Set<string>();

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
      const currentSerpDomains = new Set<string>();

      for (const item of result.results) {
        if (!item.url || !item.domain) continue;
        const isOwn = sameDomain(item.domain, ownDomain);
        let competitorId: string | undefined;
        if (!isOwn) {
          competitorId = await repository.upsertCompetitor(context, {
            domain: item.domain,
            ...(item.title ? { displayName: item.title } : {}),
            now,
            provenance: result.provenance,
          });
          if (!discoveredDomainKeys.has(item.domain)) {
            discoveredDomainKeys.add(item.domain);
            discoveredCompetitors += 1;
          }
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
        if (!currentSerpDomains.has(item.domain)) {
          changes += await repository.detectChanges(context, {
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
          currentSerpDomains.add(item.domain);
        }
        observations += 1;
        runObservationCount += 1;
      }

      const previousDomains = await previousDomainsForQuery(database, row, runId);
      const currentDomains = new Set(
        result.results.filter((item) => item.domain && !sameDomain(item.domain, ownDomain)).map((item) => item.domain!),
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

      let partialError: string | undefined;
      const competitorPageUrls = selectCompetitorPageUrls(
        result.results,
        ownDomain,
        config.pageSampleLimit ?? 5,
      );
      if (competitorPageUrls.length) {
        try {
          const snapshots = await provider.observePages(competitorPageUrls, row.locale);
          for (const snapshot of snapshots) {
          const domain = normalizeDomainSafe(snapshot.url);
          const competitorId = await repository.upsertCompetitor(context, {
            domain,
            now,
            provenance: snapshot.provenance,
          });
          await repository.recordPageSnapshot(context, {
            id: runId + ":page:" + crypto.randomUUID(),
            competitorId,
            queryText: row.queryText,
            resultUrl: snapshot.url,
            observedAt: now,
            ...(snapshot.statusCode !== undefined ? { statusCode: snapshot.statusCode } : {}),
            ...(snapshot.title ? { title: snapshot.title } : {}),
            ...(snapshot.description ? { description: snapshot.description } : {}),
            ...(snapshot.canonicalUrl ? { canonicalUrl: snapshot.canonicalUrl } : {}),
            ...(snapshot.h1Count !== undefined ? { h1Count: snapshot.h1Count } : {}),
            ...(snapshot.wordCount !== undefined ? { wordCount: snapshot.wordCount } : {}),
            ...(snapshot.internalLinksCount !== undefined ? { internalLinksCount: snapshot.internalLinksCount } : {}),
            ...(snapshot.externalLinksCount !== undefined ? { externalLinksCount: snapshot.externalLinksCount } : {}),
            ...(snapshot.imagesCount !== undefined ? { imagesCount: snapshot.imagesCount } : {}),
            ...(snapshot.titleLength !== undefined ? { titleLength: snapshot.titleLength } : {}),
            ...(snapshot.descriptionLength !== undefined ? { descriptionLength: snapshot.descriptionLength } : {}),
            ...(snapshot.noH1Tag !== undefined ? { noH1Tag: snapshot.noH1Tag } : {}),
            ...(snapshot.noTitle !== undefined ? { noTitle: snapshot.noTitle } : {}),
            ...(snapshot.noDescription !== undefined ? { noDescription: snapshot.noDescription } : {}),
            ...(snapshot.seoFriendlyUrl !== undefined ? { seoFriendlyUrl: snapshot.seoFriendlyUrl } : {}),
            ...(snapshot.structuredDataErrors !== undefined ? { structuredDataErrors: snapshot.structuredDataErrors } : {}),
            provenance: snapshot.provenance,
          });
            pageSnapshots += 1;
          }
        } catch (error) {
          failures += 1;
          partialError = error instanceof Error ? error.message : "Competitor page snapshot measurement failed.";
        }
      }

      const previousAiCitations = await previousCitationRows(database, row, runId);
      for (const previous of previousAiCitations) {
        if (!citationUrls.has(normalizeUrl(previous.resultUrl))) {
          await repository.recordChange(context, {
            queryText: row.queryText,
            competitorId: previous.competitorId ?? undefined,
            changeType: "ai-citation-lost",
            previousUrl: previous.resultUrl,
            detectedAt: now,
            provenance: { ...result.provenance, previousObservedAt: previous.observedAt },
          });
          changes += 1;
        }
      }

      for (const citation of result.aiCitations) {
        const domain = citation.domain ?? normalizeDomainSafe(citation.url);
        if (sameDomain(domain, ownDomain)) continue;
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
        changes += await repository.detectChanges(context, {
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
        status: partialError ? "partial" : "succeeded",
        completedAt: now,
        resultCount: runObservationCount,
        ...(partialError ? { errorText: partialError } : {}),
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

  return { queries: rows.length, runs, observations, discoveredCompetitors, changes, failures, pageSnapshots };
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

async function previousCitationRows(
  database: D1Database,
  row: CompetitiveQueryRow,
  runId: string,
): Promise<readonly { competitorId: string | null; resultUrl: string; observedAt: string }[]> {
  return database.all(
    `SELECT competitor_id AS competitorId, result_url AS resultUrl, observed_at AS observedAt
       FROM seo_competitive_observations
      WHERE organization_id=? AND workspace_id IS ? AND query_text=? AND run_id<>?
        AND result_type='ai_citation'
      ORDER BY observed_at DESC`,
    row.organizationId, row.workspaceId, row.queryText, runId,
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

function selectCompetitorPageUrls(
  items: readonly { readonly domain?: string; readonly url?: string }[],
  ownDomain: string,
  limit: number,
): readonly string[] {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 10);
  const seenDomains = new Set<string>();
  const urls: string[] = [];
  for (const item of items) {
    if (!item.url || !item.domain || sameDomain(item.domain, ownDomain)) continue;
    if (seenDomains.has(item.domain)) continue;
    seenDomains.add(item.domain);
    urls.push(item.url);
    if (urls.length >= safeLimit) break;
  }
  return urls;
}

function sameDomain(domain: string, ownDomain: string): boolean {
  return domain.trim().toLowerCase().replace(/^www\./, "") === ownDomain;
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
