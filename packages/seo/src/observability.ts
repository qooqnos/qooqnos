import type { RequestContext } from "@qooqnos/core";
import { D1Database, Repository } from "@qooqnos/database";

export interface SeoObservationInput {
  readonly id: string;
  readonly surface: string;
  readonly metric: string;
  readonly entityId?: string;
  readonly queryClass?: string;
  readonly numericValue?: number;
  readonly textValue?: string;
  readonly provenance: Record<string, unknown>;
  readonly observedAt: string;
}

export class SeoObservabilityRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async record(context: RequestContext, input: SeoObservationInput): Promise<void> {
    const scope = this.scope(context);
    await this.database.run(
      `INSERT INTO seo_measurements
       (id, organization_id, workspace_id, observed_at, surface, metric, entity_id, query_class, value_numeric, value_text, provenance_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, scope.organizationId, scope.workspaceId, input.observedAt, input.surface, input.metric,
      input.entityId ?? null, input.queryClass ?? null, input.numericValue ?? null, input.textValue ?? null,
      JSON.stringify(input.provenance),
    );
  }


  async createMeasurementRun(
    context: RequestContext,
    input: {
      readonly id: string;
      readonly providerId: string;
      readonly surface: string;
      readonly queryId?: string;
      readonly queryText: string;
      readonly locale: string;
      readonly entityId?: string;
      readonly entityType?: string;
      readonly startedAt: string;
      readonly provenance: Record<string, unknown>;
    },
  ): Promise<void> {
    const scope = this.scope(context);
    await this.database.run(
      `INSERT INTO seo_measurement_runs
       (id, organization_id, workspace_id, provider_id, surface, query_id, query_text, locale, entity_id, entity_type, started_at, status, observation_count, provenance_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', 0, ?)`,
      input.id, scope.organizationId, scope.workspaceId, input.providerId, input.surface,
      input.queryId ?? null, input.queryText, input.locale, input.entityId ?? null, input.entityType ?? null,
      input.startedAt, JSON.stringify(input.provenance),
    );
  }

  async completeMeasurementRun(
    context: RequestContext,
    input: { readonly id: string; readonly status: "succeeded" | "partial" | "failed"; readonly completedAt: string; readonly observationCount: number; readonly errorText?: string; },
  ): Promise<void> {
    const scope = this.scope(context);
    await this.database.run(
      `UPDATE seo_measurement_runs
          SET completed_at=?, status=?, observation_count=?, error_text=?
        WHERE id=? AND organization_id=? AND workspace_id IS ?`,
      input.completedAt, input.status, input.observationCount, input.errorText ?? null,
      input.id, scope.organizationId, scope.workspaceId,
    );
  }

  async recordMeasurementCitation(
    context: RequestContext,
    input: {
      readonly id: string;
      readonly runId: string;
      readonly entityId?: string;
      readonly citationUrl: string;
      readonly citationTitle?: string;
      readonly citationPosition?: number;
      readonly citationCount?: number;
      readonly sourceType: string;
      readonly observedAt: string;
      readonly provenance: Record<string, unknown>;
    },
  ): Promise<void> {
    const scope = this.scope(context);
    await this.database.run(
      `INSERT INTO seo_measurement_citations
       (id, run_id, organization_id, workspace_id, entity_id, citation_url, citation_title, citation_position, citation_count, source_type, observed_at, provenance_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, input.runId, scope.organizationId, scope.workspaceId, input.entityId ?? null, input.citationUrl,
      input.citationTitle ?? null, input.citationPosition ?? null, input.citationCount ?? 1, input.sourceType,
      input.observedAt, JSON.stringify(input.provenance),
    );
  }

  private scope(context: RequestContext): { organizationId: string; workspaceId: string | null } {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ? this.requireWorkspace({ workspaceId: context.workspaceId }) : null;
    return { organizationId, workspaceId };
  }
}

export interface SeoVisibilityProvider {
  readonly id: string;
  observe(input: { query: string; locale: string; locationId?: string }): Promise<readonly SeoProviderObservation[]>;
}

export interface SeoProviderObservation {
  readonly surface: string;
  readonly metric: string;
  readonly entityId?: string;
  readonly numericValue?: number;
  readonly textValue?: string;
  readonly provenance: Record<string, unknown>;
}

export class HttpSeoVisibilityProvider implements SeoVisibilityProvider {
  constructor(
    public readonly id: string,
    private readonly endpoint: string,
    private readonly headers: Record<string, string> = {},
  ) {}

  async observe(input: { query: string; locale: string; locationId?: string }): Promise<readonly SeoProviderObservation[]> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...this.headers },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`SEO visibility provider '${this.id}' returned HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("SEO visibility provider response must be an array");
    return payload.filter(isObservation);
  }
}

function isObservation(value: unknown): value is SeoProviderObservation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.surface === "string" && typeof item.metric === "string" && (item.numericValue === undefined || typeof item.numericValue === "number");
}
