import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";


export interface SearchIndexVersionRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly generation: number;
  readonly indexSchemaVersion: string;
  readonly embeddingModelVersion: string | null;
  readonly status: "draft" | "building" | "validating" | "active" | "retired" | "failed";
  readonly sourceCheckpointReference: string | null;
  readonly createdBy: string;
  readonly activatedAt: string | null;
  readonly retiredAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DiscoveryQueryTraceRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly requestId: string;
  readonly rankingPolicyVersion: string;
  readonly cacheStatus: string | null;
  readonly latencyMs: number | null;
  readonly degradationState: string | null;
  readonly createdAt: string;
}

export interface DiscoveryEvaluationRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId | null;
  readonly workspaceId: EntityId | null;
  readonly evaluationType: "retrieval" | "ranking" | "matching" | "explanation" | "end_to_end";
  readonly datasetReference: string;
  readonly queryVersion: string | null;
  readonly indexSchemaVersion: string | null;
  readonly embeddingModelVersion: string | null;
  readonly rankingPolicyVersion: string | null;
  readonly metrics: Readonly<Record<string, unknown>>;
  readonly evaluatorVersion: string;
  readonly generatedAt: string;
  readonly createdAt: string;
}

export interface SearchDocumentRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly sourceType: string;
  readonly sourceId: EntityId;
  readonly documentVersion: number;
  readonly title: string;
  readonly body: string | null;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly eligibility: "eligible" | "ineligible";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UpsertSearchDocumentInput {
  readonly context: RequestContext;
  readonly id: EntityId;
  readonly sourceType: string;
  readonly sourceId: EntityId;
  readonly documentVersion: number;
  readonly title: string;
  readonly body?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly eligibility: "eligible" | "ineligible";
  readonly now: string;
}

export interface SearchDocumentsInput {
  readonly context: RequestContext;
  readonly query?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export class DiscoveryRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async createIndexVersion(context: RequestContext, input: {
    readonly id: EntityId;
    readonly generation: number;
    readonly indexSchemaVersion: string;
    readonly embeddingModelVersion?: string;
    readonly status?: SearchIndexVersionRecord["status"];
    readonly sourceCheckpointReference?: string;
    readonly createdBy: string;
    readonly now: string;
  }): Promise<SearchIndexVersionRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    if (!Number.isInteger(input.generation) || input.generation < 1) throw new DatabaseError("Search index generation must be positive");
    await this.database.run(
      "INSERT INTO search_index_versions (id, organization_id, workspace_id, generation, index_schema_version, embedding_model_version, status, source_checkpoint_reference, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, organizationId, workspaceId, input.generation, input.indexSchemaVersion.trim(), input.embeddingModelVersion?.trim() || null,
      input.status ?? "draft", input.sourceCheckpointReference?.trim() || null, input.createdBy.trim(), input.now, input.now,
    );
    return this.getIndexVersion(context, input.id);
  }

  async getIndexVersion(context: RequestContext, id: EntityId): Promise<SearchIndexVersionRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const row = await this.database.first<SearchIndexVersionRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, generation, index_schema_version AS indexSchemaVersion, embedding_model_version AS embeddingModelVersion, status, source_checkpoint_reference AS sourceCheckpointReference, created_by AS createdBy, activated_at AS activatedAt, retired_at AS retiredAt, created_at AS createdAt, updated_at AS updatedAt FROM search_index_versions WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1",
      id, organizationId, workspaceId,
    );
    if (!row) throw new DatabaseError("Search index version not found");
    return row;
  }

  async getActiveIndexVersion(context: RequestContext): Promise<SearchIndexVersionRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<SearchIndexVersionRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, generation, index_schema_version AS indexSchemaVersion, embedding_model_version AS embeddingModelVersion, status, source_checkpoint_reference AS sourceCheckpointReference, created_by AS createdBy, activated_at AS activatedAt, retired_at AS retiredAt, created_at AS createdAt, updated_at AS updatedAt FROM search_index_versions WHERE organization_id = ? AND workspace_id = ? AND status = 'active' LIMIT 1",
      organizationId, workspaceId,
    );
  }

  async activateIndexVersion(context: RequestContext, id: EntityId, now: string): Promise<SearchIndexVersionRecord> {
    const current = await this.getIndexVersion(context, id);
    if (current.status === "active") return current;
    if (["retired", "failed"].includes(current.status)) throw new DatabaseError("Only non-terminal search index versions can be activated");
    await this.database.run(
      "UPDATE search_index_versions SET status = 'active', activated_at = COALESCE(activated_at, ?), updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ?",
      now, now, id, current.organizationId, current.workspaceId,
    );
    return this.getIndexVersion(context, id);
  }

  async recordQueryTrace(context: RequestContext, input: {
    readonly id: EntityId;
    readonly requestId: string;
    readonly normalizedIntent?: unknown;
    readonly candidateCounts?: unknown;
    readonly retrievalSources?: unknown;
    readonly policyExclusions?: unknown;
    readonly rankingPolicyVersion: string;
    readonly cacheStatus?: string;
    readonly latencyMs?: number;
    readonly degradationState?: string;
    readonly resultIds?: readonly EntityId[];
    readonly now: string;
  }): Promise<DiscoveryQueryTraceRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    if (input.latencyMs !== undefined && (!Number.isInteger(input.latencyMs) || input.latencyMs < 0)) throw new DatabaseError("Discovery query latency must be a non-negative integer");
    await this.database.run(
      "INSERT INTO discovery_query_traces (id, organization_id, workspace_id, request_id, normalized_intent_json, candidate_counts_json, retrieval_sources_json, policy_exclusions_json, ranking_policy_version, cache_status, latency_ms, degradation_state, result_ids_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, organizationId, workspaceId, input.requestId.trim(),
      input.normalizedIntent === undefined ? null : JSON.stringify(input.normalizedIntent),
      input.candidateCounts === undefined ? null : JSON.stringify(input.candidateCounts),
      input.retrievalSources === undefined ? null : JSON.stringify(input.retrievalSources),
      input.policyExclusions === undefined ? null : JSON.stringify(input.policyExclusions),
      input.rankingPolicyVersion.trim(), input.cacheStatus?.trim() || null, input.latencyMs ?? null,
      input.degradationState?.trim() || null, input.resultIds ? JSON.stringify(input.resultIds) : null, input.now,
    );
    const row = await this.database.first<DiscoveryQueryTraceRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, request_id AS requestId, ranking_policy_version AS rankingPolicyVersion, cache_status AS cacheStatus, latency_ms AS latencyMs, degradation_state AS degradationState, created_at AS createdAt FROM discovery_query_traces WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("Discovery query trace not found after creation");
    return row;
  }

  async recordEvaluation(context: RequestContext, input: {
    readonly id: EntityId;
    readonly evaluationType: DiscoveryEvaluationRecord["evaluationType"];
    readonly datasetReference: string;
    readonly queryVersion?: string;
    readonly indexSchemaVersion?: string;
    readonly embeddingModelVersion?: string;
    readonly rankingPolicyVersion?: string;
    readonly metrics: Readonly<Record<string, unknown>>;
    readonly evaluatorVersion: string;
    readonly organizationId?: EntityId;
    readonly workspaceId?: EntityId;
    readonly generatedAt: string;
    readonly now: string;
  }): Promise<DiscoveryEvaluationRecord> {
    const organizationId = input.organizationId ?? context.tenantId;
    const workspaceId = input.workspaceId ?? context.workspaceId ?? null;
    if (workspaceId) {
      const scopedOrganizationId = this.requireOrganization({ organizationId: context.tenantId });
      const row = await this.database.first<{ organizationId: EntityId }>(
        "SELECT organization_id AS organizationId FROM workspaces WHERE id = ? LIMIT 1",
        workspaceId,
      );
      if (!row || row.organizationId !== scopedOrganizationId || organizationId !== scopedOrganizationId) throw new DatabaseError("Discovery evaluation scope is invalid");
    }
    await this.database.run(
      "INSERT INTO discovery_evaluation_records (id, organization_id, workspace_id, evaluation_type, dataset_reference, query_version, index_schema_version, embedding_model_version, ranking_policy_version, metrics_json, evaluator_version, generated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, organizationId ?? null, workspaceId, input.evaluationType, input.datasetReference.trim(), input.queryVersion?.trim() || null,
      input.indexSchemaVersion?.trim() || null, input.embeddingModelVersion?.trim() || null, input.rankingPolicyVersion?.trim() || null,
      JSON.stringify(input.metrics), input.evaluatorVersion.trim(), input.generatedAt, input.now,
    );
    const row = await this.database.first<DiscoveryEvaluationRow>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, evaluation_type AS evaluationType, dataset_reference AS datasetReference, query_version AS queryVersion, index_schema_version AS indexSchemaVersion, embedding_model_version AS embeddingModelVersion, ranking_policy_version AS rankingPolicyVersion, metrics_json AS metricsJson, evaluator_version AS evaluatorVersion, generated_at AS generatedAt, created_at AS createdAt FROM discovery_evaluation_records WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("Discovery evaluation record not found after creation");
    return { ...row, metrics: parseJsonObject(row.metricsJson) };
  }

  async get(context: RequestContext, id: EntityId): Promise<SearchDocumentRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const row = await this.database.first<SearchDocumentRow>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
              source_type AS sourceType, source_id AS sourceId,
              document_version AS documentVersion, title, body,
              metadata_json AS metadataJson, eligibility,
              created_at AS createdAt, updated_at AS updatedAt
       FROM search_documents
       WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1`,
      id, organizationId, workspaceId,
    );
    return row ? toRecord(row) : null;
  }

  async getBySource(context: RequestContext, sourceType: string, sourceId: EntityId): Promise<SearchDocumentRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const row = await this.database.first<SearchDocumentRow>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
              source_type AS sourceType, source_id AS sourceId,
              document_version AS documentVersion, title, body,
              metadata_json AS metadataJson, eligibility,
              created_at AS createdAt, updated_at AS updatedAt
       FROM search_documents
       WHERE source_type = ? AND source_id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1`,
      sourceType, sourceId, organizationId, workspaceId,
    );
    return row ? toRecord(row) : null;
  }

  async search(input: SearchDocumentsInput): Promise<SearchDocumentRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: input.context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: input.context.workspaceId });
    const limit = normalizeLimit(input.limit);
    const offset = normalizeOffset(input.offset);
    const query = input.query?.trim() ?? "";

    const rows = query
      ? await this.database.all<SearchDocumentRow>(
          `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
                  source_type AS sourceType, source_id AS sourceId,
                  document_version AS documentVersion, title, body,
                  metadata_json AS metadataJson, eligibility,
                  created_at AS createdAt, updated_at AS updatedAt
           FROM search_documents
           WHERE organization_id = ? AND workspace_id = ? AND eligibility = 'eligible'
             AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')
           ORDER BY CASE WHEN title LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
                    updated_at DESC, id ASC
           LIMIT ? OFFSET ?`,
          organizationId, workspaceId,
          `%${escapeLike(query)}%`, `%${escapeLike(query)}%`,
          `${escapeLike(query)}%`, limit, offset,
        )
      : await this.database.all<SearchDocumentRow>(
          `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
                  source_type AS sourceType, source_id AS sourceId,
                  document_version AS documentVersion, title, body,
                  metadata_json AS metadataJson, eligibility,
                  created_at AS createdAt, updated_at AS updatedAt
           FROM search_documents
           WHERE organization_id = ? AND workspace_id = ? AND eligibility = 'eligible'
           ORDER BY updated_at DESC, id ASC
           LIMIT ? OFFSET ?`,
          organizationId, workspaceId, limit, offset,
        );

    return rows.map(toRecord);
  }

  async upsert(input: UpsertSearchDocumentInput): Promise<SearchDocumentRecord> {
    const organizationId = this.requireOrganization({ organizationId: input.context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: input.context.workspaceId });
    const sourceType = input.sourceType.trim();
    if (!sourceType) throw new DatabaseError("Search document source type is required");
    if (input.documentVersion < 1 || !Number.isInteger(input.documentVersion)) throw new DatabaseError("Document version must be a positive integer");
    if (!input.title.trim()) throw new DatabaseError("Search document title is required");
    await this.database.run(
      `INSERT INTO search_documents
       (id, organization_id, workspace_id, source_type, source_id, document_version,
        title, body, metadata_json, eligibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_type, source_id) DO UPDATE SET
         organization_id = excluded.organization_id,
         workspace_id = excluded.workspace_id,
         document_version = excluded.document_version,
         title = excluded.title,
         body = excluded.body,
         metadata_json = excluded.metadata_json,
         eligibility = excluded.eligibility,
         updated_at = excluded.updated_at
       WHERE excluded.document_version >= search_documents.document_version`,
      input.id, organizationId, workspaceId, sourceType, input.sourceId,
      input.documentVersion, input.title.trim(), input.body ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null, input.eligibility, input.now, input.now,
    );
    const record = await this.getBySource(input.context, sourceType, input.sourceId);
    if (!record) throw new DatabaseError("Search document not found after upsert");
    return record;
  }
}

interface DiscoveryEvaluationRow extends Omit<DiscoveryEvaluationRecord, "metrics"> {
  readonly metricsJson: string;
}

interface SearchDocumentRow extends Omit<SearchDocumentRecord, "metadata"> {
  readonly metadataJson: string | null;
}

function toRecord(row: SearchDocumentRow): SearchDocumentRecord {
  return { ...row, metadata: row.metadataJson ? JSON.parse(row.metadataJson) as Readonly<Record<string, unknown>> : null };
}

function parseJsonObject(value: string): Readonly<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object");
    return parsed as Readonly<Record<string, unknown>>;
  } catch {
    throw new DatabaseError("Stored Discovery metrics are invalid");
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return 20;
  if (!Number.isInteger(limit) || limit < 1) throw new DatabaseError("Search limit must be a positive integer");
  return Math.min(limit, 50);
}

function normalizeOffset(offset: number | undefined): number {
  if (offset === undefined) return 0;
  if (!Number.isInteger(offset) || offset < 0) throw new DatabaseError("Search offset must be a non-negative integer");
  return offset;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
