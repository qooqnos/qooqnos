import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "./client";

export interface SellerAICreationSessionRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly actorId: EntityId | null;
  readonly status: string;
  readonly currentDraftVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SellerAIDraftRecord {
  readonly id: EntityId;
  readonly sessionId: EntityId;
  readonly version: number;
  readonly status: "draft" | "seller_review" | "confirmed" | "superseded" | "rejected";
  readonly draftJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SellerAIProvenanceRecord {
  readonly fieldPath: string;
  readonly provenance: "seller_input" | "seller_confirmed" | "ai_extracted" | "ai_generated" | "system_derived" | "external_verified" | "policy_validated";
  readonly confidence: "confirmed" | "high_confidence" | "needs_review" | "unknown" | "conflicting" | "rejected";
  readonly sourceRefs: readonly string[];
}

export class SellerAIRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async createSession(context: RequestContext, id: EntityId, now: string): Promise<SellerAICreationSessionRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    await this.database.run(
      `INSERT INTO seller_ai_creation_sessions
       (id, organization_id, workspace_id, actor_id, status, current_draft_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'initiated', 0, ?, ?)`,
      id,
      organizationId,
      workspaceId,
      context.actorId ?? null,
      now,
      now,
    );
    const record = await this.getSession(context, id);
    if (!record) throw new DatabaseError("Seller AI session not found after creation");
    return record;
  }

  async getSession(context: RequestContext, id: EntityId): Promise<SellerAICreationSessionRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<SellerAICreationSessionRecord>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
              actor_id AS actorId, status, current_draft_version AS currentDraftVersion,
              created_at AS createdAt, updated_at AS updatedAt
       FROM seller_ai_creation_sessions
       WHERE id = ? AND organization_id = ? AND workspace_id = ?
       LIMIT 1`,
      id,
      organizationId,
      workspaceId,
    );
  }

  async addInput(context: RequestContext, input: { readonly id: EntityId; readonly sessionId: EntityId; readonly mediaAssetId?: EntityId; readonly rawText?: string; readonly inputHash: string; readonly now: string }): Promise<void> {
    const session = await this.getSession(context, input.sessionId);
    if (!session) throw new DatabaseError("Seller AI session not found");
    if (input.mediaAssetId) {
      const asset = await this.database.first<{ id: string }>(
        `SELECT id FROM media_assets WHERE id = ? AND organization_id = ? AND workspace_id = ? AND status <> 'deleted' LIMIT 1`,
        input.mediaAssetId,
        session.organizationId,
        session.workspaceId,
      );
      if (!asset) throw new DatabaseError("Media asset is outside the seller AI session scope");
    }
    if (!input.mediaAssetId && !input.rawText?.trim()) throw new DatabaseError("Seller AI input is empty");
    await this.database.transaction([
      {
        sql: `INSERT INTO seller_ai_inputs (id, session_id, media_asset_id, raw_text, input_hash, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [input.id, input.sessionId, input.mediaAssetId ?? null, input.rawText ?? null, input.inputHash, input.now],
      },
      {
        sql: `UPDATE seller_ai_creation_sessions SET status = 'analyzing', updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ?`,
        params: [input.now, input.sessionId, session.organizationId, session.workspaceId],
      },
    ]);
  }

  async saveDraft(context: RequestContext, input: { readonly id: EntityId; readonly sessionId: EntityId; readonly version: number; readonly draftJson: string; readonly provenance: readonly SellerAIProvenanceRecord[]; readonly now: string }): Promise<SellerAIDraftRecord> {
    const session = await this.getSession(context, input.sessionId);
    if (!session) throw new DatabaseError("Seller AI session not found");
    if (input.version !== session.currentDraftVersion + 1) throw new DatabaseError("Seller AI draft version is not the next expected version");
    const fieldPaths = new Set<string>();
    for (const record of input.provenance) {
      if (!record.fieldPath.trim() || fieldPaths.has(record.fieldPath)) throw new DatabaseError("Seller AI draft provenance contains duplicate field paths");
      fieldPaths.add(record.fieldPath);
    }
    const statements = [
      { sql: `UPDATE seller_ai_drafts SET status = 'superseded', updated_at = ? WHERE session_id = ? AND status IN ('draft','seller_review')`, params: [input.now, input.sessionId] },
      { sql: `INSERT INTO seller_ai_drafts (id, session_id, version, status, draft_json, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?, ?)`, params: [input.id, input.sessionId, input.version, input.draftJson, input.now, input.now] },
      ...input.provenance.map((record) => ({
        sql: `INSERT INTO seller_ai_field_provenance (id, draft_id, field_path, provenance, confidence, source_refs_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          crypto.randomUUID(),
          input.id,
          record.fieldPath,
          record.provenance,
          record.confidence,
          JSON.stringify(record.sourceRefs),
          input.now,
        ],
      })),
      { sql: `UPDATE seller_ai_creation_sessions SET status = 'draft_ready', current_draft_version = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ?`, params: [input.version, input.now, input.sessionId, session.organizationId, session.workspaceId] },
    ];
    const results = await this.database.transaction(statements);
    const sessionUpdate = results[results.length - 1];
    if (sessionUpdate?.meta?.changes !== 1) throw new DatabaseError("Seller AI session was not updated after draft creation");
    const record = await this.database.first<SellerAIDraftRecord>(
      `SELECT id, session_id AS sessionId, version, status, draft_json AS draftJson, created_at AS createdAt, updated_at AS updatedAt FROM seller_ai_drafts WHERE id = ? AND session_id = ? LIMIT 1`,
      input.id,
      input.sessionId,
    );
    if (!record) throw new DatabaseError("Seller AI draft not found after creation");
    return record;
  }

  async reviewDraft(context: RequestContext, sessionId: EntityId, version: number, now: string): Promise<SellerAIDraftRecord> {
    const session = await this.getSession(context, sessionId);
    if (!session) throw new DatabaseError("Seller AI session not found");
    if (session.currentDraftVersion !== version) throw new DatabaseError("Seller AI draft version is stale");
    const results = await this.database.transaction([
      {
        sql: `UPDATE seller_ai_drafts SET status = 'seller_review', updated_at = ? WHERE session_id = ? AND version = ? AND status = 'draft'`,
        params: [now, sessionId, version],
      },
      {
        sql: `UPDATE seller_ai_creation_sessions SET status = 'seller_review', updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ? AND current_draft_version = ?`,
        params: [now, sessionId, session.organizationId, session.workspaceId, version],
      },
    ]);
    if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1) throw new DatabaseError("Seller AI draft is not reviewable");
    const draft = await this.database.first<SellerAIDraftRecord>(
      `SELECT id, session_id AS sessionId, version, status, draft_json AS draftJson, created_at AS createdAt, updated_at AS updatedAt
       FROM seller_ai_drafts WHERE session_id = ? AND version = ? LIMIT 1`,
      sessionId,
      version,
    );
    if (!draft || draft.status !== "seller_review") throw new DatabaseError("Seller AI draft is not reviewable");
    return draft;
  }

  async confirmDraft(context: RequestContext, sessionId: EntityId, version: number, now: string): Promise<SellerAIDraftRecord> {
    const session = await this.getSession(context, sessionId);
    if (!session) throw new DatabaseError("Seller AI session not found");
    if (session.currentDraftVersion !== version) throw new DatabaseError("Seller AI draft version is stale");
    const results = await this.database.transaction([
      {
        sql: `UPDATE seller_ai_drafts SET status = 'confirmed', updated_at = ? WHERE session_id = ? AND version = ? AND status = 'seller_review'`,
        params: [now, sessionId, version],
      },
      {
        sql: `UPDATE seller_ai_creation_sessions SET status = 'confirmed', updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ? AND current_draft_version = ?`,
        params: [now, sessionId, session.organizationId, session.workspaceId, version],
      },
    ]);
    if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1) throw new DatabaseError("Seller AI draft must be reviewed before confirmation");
    const draft = await this.database.first<SellerAIDraftRecord>(
      `SELECT id, session_id AS sessionId, version, status, draft_json AS draftJson, created_at AS createdAt, updated_at AS updatedAt
       FROM seller_ai_drafts WHERE session_id = ? AND version = ? LIMIT 1`,
      sessionId,
      version,
    );
    if (!draft || draft.status !== "confirmed") throw new DatabaseError("Seller AI draft must be reviewed before confirmation");
    return draft;
  }

  async cancelSession(context: RequestContext, sessionId: EntityId, now: string): Promise<boolean> {
    const session = await this.getSession(context, sessionId);
    if (!session) throw new DatabaseError("Seller AI session not found");
    if (["published", "cancelled", "expired"].includes(session.status)) return false;
    const result = await this.database.run(
      `UPDATE seller_ai_creation_sessions SET status = 'cancelled', updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ? AND status NOT IN ('published','cancelled','expired')`,
      now,
      sessionId,
      session.organizationId,
      session.workspaceId,
    );
    return result.meta?.changes === undefined ? true : result.meta.changes === 1;
  }

  async getDraft(context: RequestContext, sessionId: EntityId): Promise<SellerAIDraftRecord | null> {
    const session = await this.getSession(context, sessionId);
    if (!session || session.currentDraftVersion === 0) return null;
    return this.database.first<SellerAIDraftRecord>(
      `SELECT id, session_id AS sessionId, version, status, draft_json AS draftJson, created_at AS createdAt, updated_at AS updatedAt
       FROM seller_ai_drafts WHERE session_id = ? AND version = ? LIMIT 1`,
      sessionId,
      session.currentDraftVersion,
    );
  }
}
