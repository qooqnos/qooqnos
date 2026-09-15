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
    await this.database.run(
      `INSERT INTO seller_ai_inputs (id, session_id, media_asset_id, raw_text, input_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.id,
      input.sessionId,
      input.mediaAssetId ?? null,
      input.rawText ?? null,
      input.inputHash,
      input.now,
    );
    await this.database.run(
      `UPDATE seller_ai_creation_sessions SET status = 'analyzing', updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ?`,
      input.now,
      input.sessionId,
      session.organizationId,
      session.workspaceId,
    );
  }

  async saveDraft(context: RequestContext, input: { readonly id: EntityId; readonly sessionId: EntityId; readonly version: number; readonly draftJson: string; readonly now: string }): Promise<SellerAIDraftRecord> {
    const session = await this.getSession(context, input.sessionId);
    if (!session) throw new DatabaseError("Seller AI session not found");
    if (input.version !== session.currentDraftVersion + 1) throw new DatabaseError("Seller AI draft version is not the next expected version");
    await this.database.transaction([
      { sql: `UPDATE seller_ai_drafts SET status = 'superseded', updated_at = ? WHERE session_id = ? AND status IN ('draft','seller_review')`, params: [input.now, input.sessionId] },
      { sql: `INSERT INTO seller_ai_drafts (id, session_id, version, status, draft_json, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?, ?)`, params: [input.id, input.sessionId, input.version, input.draftJson, input.now, input.now] },
      { sql: `UPDATE seller_ai_creation_sessions SET status = 'draft_ready', current_draft_version = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ?`, params: [input.version, input.now, input.sessionId, session.organizationId, session.workspaceId] },
    ]);
    const record = await this.database.first<SellerAIDraftRecord>(
      `SELECT id, session_id AS sessionId, version, status, draft_json AS draftJson, created_at AS createdAt, updated_at AS updatedAt FROM seller_ai_drafts WHERE id = ? AND session_id = ? LIMIT 1`,
      input.id,
      input.sessionId,
    );
    if (!record) throw new DatabaseError("Seller AI draft not found after creation");
    return record;
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
