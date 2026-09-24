import type { RequestContext } from "@qooqnos/core";
import { D1Database, Repository } from "@qooqnos/database";

export class SeoCompetitiveRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async upsertCompetitor(
    context: RequestContext,
    input: {
      readonly id?: string;
      readonly domain: string;
      readonly displayName?: string;
      readonly competitorType?: "direct" | "alternative" | "publisher" | "directory" | "discovered";
      readonly now: string;
      readonly provenance: Record<string, unknown>;
    },
  ): Promise<string> {
    const scope = this.scope(context);
    const existing = await this.database.first<{ id: string }>(
      "SELECT id FROM seo_competitors WHERE organization_id=? AND workspace_id IS ? AND domain=? LIMIT 1",
      scope.organizationId, scope.workspaceId, input.domain,
    );
    const id = existing?.id ?? input.id ?? crypto.randomUUID();
    await this.database.run(
      `INSERT INTO seo_competitors
       (id, organization_id, workspace_id, domain, display_name, competitor_type, lifecycle_state, first_observed_at, last_observed_at, provenance_json)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
       ON CONFLICT(organization_id, workspace_id, domain)
       DO UPDATE SET
         display_name=COALESCE(excluded.display_name, seo_competitors.display_name),
         last_observed_at=excluded.last_observed_at,
         provenance_json=excluded.provenance_json,
         lifecycle_state='active'`,
      id, scope.organizationId, scope.workspaceId, input.domain, input.displayName ?? null,
      input.competitorType ?? "discovered", input.now, input.now, JSON.stringify(input.provenance),
    );
    return id;
  }

  async createRun(
    context: RequestContext,
    input: {
      readonly id: string;
      readonly providerId: string;
      readonly queryId?: string;
      readonly queryText: string;
      readonly locale: string;
      readonly locationContext?: string;
      readonly device: string;
      readonly depth: number;
      readonly startedAt: string;
      readonly provenance: Record<string, unknown>;
    },
  ): Promise<void> {
    const scope = this.scope(context);
    await this.database.run(
      `INSERT INTO seo_competitive_runs
       (id, organization_id, workspace_id, provider_id, query_id, query_text, locale, location_context, device, depth, started_at, status, result_count, provenance_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', 0, ?)`,
      input.id, scope.organizationId, scope.workspaceId, input.providerId, input.queryId ?? null, input.queryText,
      input.locale, input.locationContext ?? null, input.device, input.depth, input.startedAt, JSON.stringify(input.provenance),
    );
  }

  async completeRun(
    context: RequestContext,
    input: { readonly id: string; readonly status: "succeeded" | "partial" | "failed"; readonly completedAt: string; readonly resultCount: number; readonly errorText?: string },
  ): Promise<void> {
    const scope = this.scope(context);
    await this.database.run(
      `UPDATE seo_competitive_runs
          SET completed_at=?, status=?, result_count=?, error_text=?
        WHERE id=? AND organization_id=? AND workspace_id IS ?`,
      input.completedAt, input.status, input.resultCount, input.errorText ?? null,
      input.id, scope.organizationId, scope.workspaceId,
    );
  }

  async recordObservation(
    context: RequestContext,
    input: {
      readonly id: string;
      readonly runId: string;
      readonly competitorId?: string;
      readonly entityId?: string;
      readonly queryText: string;
      readonly resultType: string;
      readonly domain: string;
      readonly resultUrl: string;
      readonly title?: string;
      readonly snippet?: string;
      readonly rankGroup?: number;
      readonly rankAbsolute?: number;
      readonly aiCitation?: boolean;
      readonly observedAt: string;
      readonly provenance: Record<string, unknown>;
    },
  ): Promise<void> {
    const scope = this.scope(context);
    await this.database.run(
      `INSERT INTO seo_competitive_observations
       (id, run_id, organization_id, workspace_id, competitor_id, entity_id, query_text, result_type, domain, result_url, title, snippet, rank_group, rank_absolute, ai_citation, observed_at, provenance_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, input.runId, scope.organizationId, scope.workspaceId, input.competitorId ?? null, input.entityId ?? null,
      input.queryText, input.resultType, input.domain, input.resultUrl, input.title ?? null, input.snippet ?? null,
      input.rankGroup ?? null, input.rankAbsolute ?? null, input.aiCitation ? 1 : 0, input.observedAt, JSON.stringify(input.provenance),
    );
  }

  async detectChanges(
    context: RequestContext,
    input: {
      readonly queryText: string;
      readonly currentRunId: string;
      readonly competitorId?: string;
      readonly domain: string;
      readonly currentUrl: string;
      readonly currentRank?: number;
      readonly currentAiCitation?: boolean;
      readonly observationType?: "serp" | "ai_citation";
      readonly detectedAt: string;
      readonly provenance: Record<string, unknown>;
    },
  ): Promise<void> {
    const scope = this.scope(context);
    const resultTypeFilter = input.observationType === "ai_citation" ? "result_type='ai_citation'" : "result_type<>'ai_citation'";
    const previous = await this.database.first<{
      resultUrl: string;
      rankAbsolute: number | null;
      aiCitation: number;
      observedAt: string;
    }>(
      `SELECT result_url AS resultUrl, rank_absolute AS rankAbsolute, ai_citation AS aiCitation, observed_at AS observedAt
         FROM seo_competitive_observations
        WHERE organization_id=? AND workspace_id IS ? AND query_text=? AND domain=? AND run_id<>?
          AND ${resultTypeFilter}
        ORDER BY observed_at DESC LIMIT 1`,
      scope.organizationId, scope.workspaceId, input.queryText, input.domain, input.currentRunId,
    );
    if (!previous) {
      await this.recordChange(context, { ...input, changeType: "new-entry", previousRank: undefined, previousUrl: undefined });
      if (input.currentAiCitation) await this.recordChange(context, { ...input, changeType: "ai-citation-gained", previousRank: undefined, previousUrl: undefined });
      return;
    }
    if (previous.resultUrl !== input.currentUrl) {
      await this.recordChange(context, { ...input, changeType: "url-changed", previousRank: previous.rankAbsolute ?? undefined, previousUrl: previous.resultUrl });
    }
    if (previous.rankAbsolute !== null && input.currentRank !== undefined && previous.rankAbsolute !== input.currentRank) {
      await this.recordChange(context, {
        ...input,
        changeType: input.currentRank < previous.rankAbsolute ? "rank-up" : "rank-down",
        previousRank: previous.rankAbsolute,
        previousUrl: previous.resultUrl,
      });
    }
    if (!previous.aiCitation && input.currentAiCitation) {
      await this.recordChange(context, { ...input, changeType: "ai-citation-gained", previousRank: previous.rankAbsolute ?? undefined, previousUrl: previous.resultUrl });
    } else if (previous.aiCitation && !input.currentAiCitation) {
      await this.recordChange(context, { ...input, changeType: "ai-citation-lost", previousRank: previous.rankAbsolute ?? undefined, previousUrl: previous.resultUrl });
    }
  }

  async recordChange(
    context: RequestContext,
    input: {
      readonly queryText: string;
      readonly detectedAt: string;
      readonly changeType: "new-entry" | "lost-entry" | "rank-up" | "rank-down" | "url-changed" | "ai-citation-gained" | "ai-citation-lost";
      readonly competitorId?: string;
      readonly previousRank?: number;
      readonly currentRank?: number;
      readonly previousUrl?: string;
      readonly currentUrl?: string;
      readonly provenance: Record<string, unknown>;
    },
  ): Promise<void> {
    const scope = this.scope(context);
    await this.database.run(
      `INSERT INTO seo_competitive_changes
       (id, organization_id, workspace_id, competitor_id, query_text, change_type, previous_rank, current_rank, previous_url, current_url, detected_at, provenance_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(), scope.organizationId, scope.workspaceId, input.competitorId ?? null,
      input.queryText, input.changeType, input.previousRank ?? null, input.currentRank ?? null,
      input.previousUrl ?? null, input.currentUrl ?? null, input.detectedAt, JSON.stringify(input.provenance),
    );
  }

  async recordPageSnapshot(
    context: RequestContext,
    input: {
      readonly id: string;
      readonly competitorId?: string;
      readonly queryText?: string;
      readonly resultUrl: string;
      readonly observedAt: string;
      readonly statusCode?: number;
      readonly title?: string;
      readonly description?: string;
      readonly canonicalUrl?: string;
      readonly h1Count?: number;
      readonly wordCount?: number;
      readonly internalLinksCount?: number;
      readonly externalLinksCount?: number;
      readonly imagesCount?: number;
      readonly titleLength?: number;
      readonly descriptionLength?: number;
      readonly noH1Tag?: boolean;
      readonly noTitle?: boolean;
      readonly noDescription?: boolean;
      readonly seoFriendlyUrl?: boolean;
      readonly structuredDataErrors?: number;
      readonly provenance: Record<string, unknown>;
    },
  ): Promise<void> {
    const scope = this.scope(context);
    await this.database.run(
      `INSERT INTO seo_competitor_page_snapshots
       (id, organization_id, workspace_id, competitor_id, query_text, result_url, observed_at, status_code, title, description,
        canonical_url, h1_count, word_count, internal_links_count, external_links_count, images_count, title_length,
        description_length, no_h1_tag, no_title, no_description, seo_friendly_url, structured_data_errors, provenance_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, scope.organizationId, scope.workspaceId, input.competitorId ?? null, input.queryText ?? null,
      input.resultUrl, input.observedAt, input.statusCode ?? null, input.title ?? null, input.description ?? null,
      input.canonicalUrl ?? null, input.h1Count ?? null, input.wordCount ?? null, input.internalLinksCount ?? null,
      input.externalLinksCount ?? null, input.imagesCount ?? null, input.titleLength ?? null, input.descriptionLength ?? null,
      input.noH1Tag === undefined ? null : input.noH1Tag ? 1 : 0,
      input.noTitle === undefined ? null : input.noTitle ? 1 : 0,
      input.noDescription === undefined ? null : input.noDescription ? 1 : 0,
      input.seoFriendlyUrl === undefined ? null : input.seoFriendlyUrl ? 1 : 0,
      input.structuredDataErrors ?? null, JSON.stringify(input.provenance),
    );
  }

  async latestSummary(context: RequestContext, entityId: string): Promise<{
    competitors: readonly Record<string, unknown>[];
    changes: readonly Record<string, unknown>[];
    opportunities: readonly Record<string, unknown>[];
    pageSnapshots: readonly Record<string, unknown>[];
  }> {
    const scope = this.scope(context);
    const pageSnapshots = await this.database.all(
      `SELECT s.result_url AS resultUrl, s.observed_at AS observedAt, s.status_code AS statusCode, s.title, s.description,
              s.canonical_url AS canonicalUrl, s.h1_count AS h1Count, s.word_count AS wordCount,
              s.internal_links_count AS internalLinksCount, s.external_links_count AS externalLinksCount,
              s.images_count AS imagesCount, s.title_length AS titleLength, s.description_length AS descriptionLength,
              c.domain
         FROM seo_competitor_page_snapshots s
         LEFT JOIN seo_competitors c ON c.id=s.competitor_id
        WHERE s.organization_id=? AND s.workspace_id IS ?
        ORDER BY s.observed_at DESC LIMIT 50`,
      scope.organizationId, scope.workspaceId,
    );
    const competitors = await this.database.all(
      `SELECT c.id, c.domain, c.display_name AS displayName, c.competitor_type AS competitorType, c.last_observed_at AS lastObservedAt,
              COUNT(o.id) AS observations, MIN(o.rank_absolute) AS bestObservedRank
         FROM seo_competitors c
         LEFT JOIN seo_competitive_observations o
           ON o.competitor_id=c.id AND o.organization_id=c.organization_id AND o.workspace_id IS c.workspace_id
        WHERE c.organization_id=? AND c.workspace_id IS ? AND c.lifecycle_state='active'
        GROUP BY c.id
        ORDER BY observations DESC, bestObservedRank ASC LIMIT 50`,
      scope.organizationId, scope.workspaceId,
    );
    const changes = await this.database.all(
      `SELECT query_text AS queryText, change_type AS changeType, previous_rank AS previousRank, current_rank AS currentRank,
              previous_url AS previousUrl, current_url AS currentUrl, detected_at AS detectedAt
         FROM seo_competitive_changes
        WHERE organization_id=? AND workspace_id IS ?
        ORDER BY detected_at DESC LIMIT 100`,
      scope.organizationId, scope.workspaceId,
    );
    const opportunities = await this.database.all(
      `SELECT o.query_text AS queryText,
              MIN(o.rank_absolute) AS competitorBestRank,
              COUNT(DISTINCT o.domain) AS competitorDomains
         FROM seo_queries q
         JOIN seo_competitive_observations o
           ON o.organization_id=q.organization_id
          AND o.workspace_id IS q.workspace_id
          AND o.query_text=q.query_text
          AND o.result_type<>'ai_citation'
         JOIN seo_competitive_runs r
           ON r.id=o.run_id
          AND r.organization_id=o.organization_id
          AND r.workspace_id IS o.workspace_id
        WHERE q.organization_id=? AND q.workspace_id IS ? AND q.entity_id=?
          AND NOT EXISTS (
            SELECT 1
              FROM seo_competitive_observations own
             WHERE own.run_id=o.run_id
               AND own.entity_id=q.entity_id
          )
        GROUP BY o.query_text
        ORDER BY competitorBestRank ASC
        LIMIT 50`,
      scope.organizationId, scope.workspaceId, entityId,
    );
    return { competitors, changes, opportunities, pageSnapshots };
  }

  private scope(context: RequestContext): { organizationId: string; workspaceId: string | null } {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ? this.requireWorkspace({ workspaceId: context.workspaceId }) : null;
    return { organizationId, workspaceId };
  }
}
