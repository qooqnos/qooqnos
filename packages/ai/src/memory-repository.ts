import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type AIMemoryOwnerScope = "user" | "workspace";
export type AIMemoryClassification = "public" | "internal" | "confidential" | "sensitive" | "restricted";

export interface AIMemoryRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly ownerScope: AIMemoryOwnerScope;
  readonly ownerReference: string;
  readonly memoryType: string;
  readonly contentReference: string;
  readonly provenance: readonly string[];
  readonly consentReference: string | null;
  readonly classification: AIMemoryClassification;
  readonly version: number;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly deletedAt: string | null;
}

export interface CreateAIMemoryInput {
  readonly id: EntityId;
  readonly ownerScope: AIMemoryOwnerScope;
  readonly ownerReference: string;
  readonly memoryType: string;
  readonly contentReference: string;
  readonly provenance: readonly string[];
  readonly consentReference?: string;
  readonly classification: AIMemoryClassification;
  readonly version?: number;
  readonly expiresAt?: string;
  readonly now: string;
}

export class AIMemoryRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async create(context: RequestContext, input: CreateAIMemoryInput): Promise<AIMemoryRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ?? null;
    if (input.ownerScope === "workspace" && !workspaceId) throw new DatabaseError("Workspace AI memory requires workspace scope");
    if (!input.ownerReference.trim() || !input.memoryType.trim() || !input.contentReference.trim()) throw new DatabaseError("AI memory owner/type/content reference is required");
    if (input.classification === "sensitive" || input.classification === "restricted") {
      if (!input.consentReference?.trim()) throw new DatabaseError("Sensitive AI memory requires consent reference");
    }
    const version = input.version ?? 1;
    if (!Number.isInteger(version) || version < 1) throw new DatabaseError("AI memory version is invalid");
    if (input.expiresAt && input.expiresAt <= input.now) throw new DatabaseError("AI memory expiry must be after creation");

    await this.database.run(
      `INSERT INTO ai_memory
       (id, organization_id, workspace_id, owner_scope, owner_reference, memory_type,
        content_reference, provenance_json, consent_reference, classification, version,
        created_at, expires_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      input.id, organizationId, workspaceId, input.ownerScope, input.ownerReference.trim(),
      input.memoryType.trim(), input.contentReference.trim(), JSON.stringify(input.provenance),
      input.consentReference?.trim() ?? null, input.classification, version, input.now,
      input.expiresAt ?? null,
    );
    return this.get(context, input.id);
  }

  async get(context: RequestContext, id: EntityId): Promise<AIMemoryRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const row = await this.database.first<AIMemoryRow>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
              owner_scope AS ownerScope, owner_reference AS ownerReference, memory_type AS memoryType,
              content_reference AS contentReference, provenance_json AS provenanceJson,
              consent_reference AS consentReference, classification, version,
              created_at AS createdAt, expires_at AS expiresAt, deleted_at AS deletedAt
       FROM ai_memory
       WHERE id = ? AND organization_id = ?
         AND (workspace_id IS NULL OR workspace_id = ?)
       LIMIT 1`,
      id, organizationId, context.workspaceId ?? null,
    );
    if (!row) throw new DatabaseError("AI memory not found");
    return toMemory(row);
  }

  async list(context: RequestContext, ownerScope: AIMemoryOwnerScope, ownerReference: string, limit = 50): Promise<readonly AIMemoryRecord[]> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ?? null;
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    return (await this.database.all<AIMemoryRow>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
              owner_scope AS ownerScope, owner_reference AS ownerReference, memory_type AS memoryType,
              content_reference AS contentReference, provenance_json AS provenanceJson,
              consent_reference AS consentReference, classification, version,
              created_at AS createdAt, expires_at AS expiresAt, deleted_at AS deletedAt
       FROM ai_memory
       WHERE organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?)
         AND owner_scope = ? AND owner_reference = ? AND deleted_at IS NULL
         AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY created_at DESC, id DESC LIMIT ?`,
      organizationId, workspaceId, ownerScope, ownerReference, safeLimit,
    )).map(toMemory);
  }

  async delete(context: RequestContext, id: EntityId, now: string): Promise<void> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const result = await this.database.run(
      "UPDATE ai_memory SET deleted_at = ? WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) AND deleted_at IS NULL",
      now, id, organizationId, context.workspaceId ?? null,
    );
    if ((result.meta?.changes ?? 0) !== 1) throw new DatabaseError("AI memory deletion was rejected");
  }

  async expire(now: string, limit = 100): Promise<number> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    const result = await this.database.run(
      `UPDATE ai_memory SET deleted_at = ?
       WHERE id IN (
         SELECT id FROM ai_memory
         WHERE deleted_at IS NULL AND expires_at IS NOT NULL AND expires_at <= ?
         ORDER BY expires_at ASC, id ASC LIMIT ?
       )`,
      now, now, safeLimit,
    );
    return result.meta?.changes ?? 0;
  }
}

interface AIMemoryRow extends Omit<AIMemoryRecord, "provenance"> { readonly provenanceJson: string; }
function toMemory(row: AIMemoryRow): AIMemoryRecord {
  let provenance: string[];
  try {
    const parsed = JSON.parse(row.provenanceJson);
    if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) throw new Error();
    provenance = parsed;
  } catch {
    throw new DatabaseError("Stored AI memory provenance is invalid");
  }
  return { ...row, provenance };
}
