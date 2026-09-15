import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type MediaAssetStatus = "pending" | "ready" | "failed" | "deleted";
export type MediaProcessingStatus = "queued" | "processing" | "succeeded" | "failed" | "cancelled";

export interface MediaAssetRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly ownerType: string;
  readonly ownerId: EntityId;
  readonly storageProvider: "r2";
  readonly storageKey: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly checksum: string | null;
  readonly status: MediaAssetStatus;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateMediaAssetInput {
  readonly id: EntityId;
  readonly context: RequestContext;
  readonly ownerType: string;
  readonly ownerId: EntityId;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly checksum?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly now: string;
}

export interface CreateMediaProcessingJobInput {
  readonly id: EntityId;
  readonly assetId: EntityId;
  readonly operation: string;
  readonly operationVersion?: number;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly availableAt: string;
  readonly now: string;
}

export class MediaRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async get(context: RequestContext, id: EntityId): Promise<MediaAssetRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const row = await this.database.first<MediaAssetRow>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
              owner_type AS ownerType, owner_id AS ownerId, storage_provider AS storageProvider,
              storage_key AS storageKey, mime_type AS mimeType, byte_size AS byteSize,
              checksum, status, metadata_json AS metadataJson,
              created_at AS createdAt, updated_at AS updatedAt
       FROM media_assets
       WHERE id = ? AND organization_id = ? AND workspace_id = ?
       LIMIT 1`,
      id, organizationId, workspaceId,
    );
    return row ? toAsset(row) : null;
  }

  async create(input: CreateMediaAssetInput): Promise<MediaAssetRecord> {
    const organizationId = this.requireOrganization({ organizationId: input.context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: input.context.workspaceId });
    if (!input.storageKey.trim()) throw new DatabaseError("Media storage key is required");
    if (!input.mimeType.trim()) throw new DatabaseError("Media MIME type is required");
    if (!Number.isSafeInteger(input.byteSize) || input.byteSize < 0) throw new DatabaseError("Media byte size is invalid");
    await this.database.run(
      `INSERT INTO media_assets
       (id, organization_id, workspace_id, owner_type, owner_id, storage_provider, storage_key,
        mime_type, byte_size, checksum, status, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'r2', ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      input.id, organizationId, workspaceId, input.ownerType.trim(), input.ownerId,
      input.storageKey.trim(), input.mimeType.trim(), input.byteSize, input.checksum ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null, input.now, input.now,
    );
    const record = await this.get(input.context, input.id);
    if (!record) throw new DatabaseError("Media asset not found after creation");
    return record;
  }

  async setStatus(context: RequestContext, id: EntityId, status: MediaAssetStatus, now: string): Promise<MediaAssetRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const result = await this.database.run(
      `UPDATE media_assets SET status = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND workspace_id = ?`,
      status, now, id, organizationId, workspaceId,
    );
    if ((result.meta?.changes ?? 0) !== 1) throw new DatabaseError("Media asset status update was rejected");
    const record = await this.get(context, id);
    if (!record) throw new DatabaseError("Media asset not found after status update");
    return record;
  }

  async createProcessingJob(input: CreateMediaProcessingJobInput): Promise<void> {
    if (!input.operation.trim()) throw new DatabaseError("Media processing operation is required");
    await this.database.run(
      `INSERT INTO media_processing_jobs
       (id, asset_id, operation, operation_version, status, attempts, input_json, available_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?)`,
      input.id, input.assetId, input.operation.trim(), input.operationVersion ?? 1,
      input.input ? JSON.stringify(input.input) : null, input.availableAt, input.now, input.now,
    );
  }
}

interface MediaAssetRow extends Omit<MediaAssetRecord, "metadata"> {
  readonly metadataJson: string | null;
}

function toAsset(row: MediaAssetRow): MediaAssetRecord {
  return {
    ...row,
    metadata: row.metadataJson ? JSON.parse(row.metadataJson) as Readonly<Record<string, unknown>> : null,
  };
}
