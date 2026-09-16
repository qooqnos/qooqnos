import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

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

interface SearchDocumentRow extends Omit<SearchDocumentRecord, "metadata"> {
  readonly metadataJson: string | null;
}

function toRecord(row: SearchDocumentRow): SearchDocumentRecord {
  return { ...row, metadata: row.metadataJson ? JSON.parse(row.metadataJson) as Readonly<Record<string, unknown>> : null };
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
