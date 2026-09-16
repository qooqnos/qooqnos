import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "./client";

export interface SellerAICreationSessionRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly businessId: EntityId | null;
  readonly catalogProductId: EntityId | null;
  readonly actorId: EntityId | null;
  readonly status: string;
  readonly currentDraftVersion: number;
  readonly idempotencyKey: string | null;
  readonly requestFingerprint: string | null;
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly expiresAt: string | null;
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

  async createSession(
    context: RequestContext,
    id: EntityId,
    now: string,
    input: {
      readonly businessId: EntityId;
      readonly idempotencyKey: string;
      readonly requestFingerprint: string;
      readonly expiresAt?: string | undefined;
    },
  ): Promise<SellerAICreationSessionRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const business = await this.database.first<{ id: EntityId }>(
      `SELECT id FROM businesses WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1`,
      input.businessId,
      organizationId,
      workspaceId,
    );
    if (!business) throw new DatabaseError("Business is not available in the current workspace");

    await this.database.run(
      `INSERT OR IGNORE INTO seller_ai_creation_sessions
       (id, organization_id, workspace_id, business_id, actor_id, status, current_draft_version,
        idempotency_key, request_fingerprint, request_id, correlation_id, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'initiated', 0, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      organizationId,
      workspaceId,
      input.businessId,
      context.actorId ?? null,
      input.idempotencyKey,
      input.requestFingerprint,
      context.requestId,
      context.correlationId,
      input.expiresAt ?? null,
      now,
      now,
    );

    const record = await this.getSession(context, id);
    if (record) return record;
    const replay = await this.database.first<SellerAICreationSessionRecord>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
              business_id AS businessId, catalog_product_id AS catalogProductId,
              actor_id AS actorId, status, current_draft_version AS currentDraftVersion,
              idempotency_key AS idempotencyKey, request_fingerprint AS requestFingerprint,
              request_id AS requestId, correlation_id AS correlationId, expires_at AS expiresAt,
              created_at AS createdAt, updated_at AS updatedAt
       FROM seller_ai_creation_sessions
       WHERE idempotency_key = ? AND organization_id = ? AND workspace_id = ?
       LIMIT 1`,
      input.idempotencyKey,
      organizationId,
      workspaceId,
    );
    if (!replay) throw new DatabaseError("Seller AI session not found after creation");
    if (replay.requestFingerprint !== input.requestFingerprint) {
      throw new DatabaseError("Seller AI idempotency key was reused with a different request");
    }
    return replay;
  }

  async getSession(context: RequestContext, id: EntityId): Promise<SellerAICreationSessionRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<SellerAICreationSessionRecord>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
              business_id AS businessId, catalog_product_id AS catalogProductId,
              actor_id AS actorId, status, current_draft_version AS currentDraftVersion,
              idempotency_key AS idempotencyKey, request_fingerprint AS requestFingerprint,
              request_id AS requestId, correlation_id AS correlationId, expires_at AS expiresAt,
              created_at AS createdAt, updated_at AS updatedAt
       FROM seller_ai_creation_sessions
       WHERE id = ? AND organization_id = ? AND workspace_id = ?
       LIMIT 1`,
      id,
      organizationId,
      workspaceId,
    );
  }

  async addInput(
    context: RequestContext,
    input: { readonly id: EntityId; readonly sessionId: EntityId; readonly mediaAssetId?: EntityId; readonly rawText?: string; readonly inputHash: string; readonly now: string },
  ): Promise<void> {
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
      { sql: `INSERT INTO seller_ai_inputs (id, session_id, media_asset_id, raw_text, input_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)`, params: [input.id, input.sessionId, input.mediaAssetId ?? null, input.rawText ?? null, input.inputHash, input.now] },
      { sql: `UPDATE seller_ai_creation_sessions SET status = 'analyzing', updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ?`, params: [input.now, input.sessionId, session.organizationId, session.workspaceId] },
    ]);
  }

  async saveDraft(
    context: RequestContext,
    input: { readonly id: EntityId; readonly sessionId: EntityId; readonly version: number; readonly draftJson: string; readonly provenance: readonly SellerAIProvenanceRecord[]; readonly now: string },
  ): Promise<SellerAIDraftRecord> {
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
      ...input.provenance.map((record) => ({ sql: `INSERT INTO seller_ai_field_provenance (id, draft_id, field_path, provenance, confidence, source_refs_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, params: [crypto.randomUUID(), input.id, record.fieldPath, record.provenance, record.confidence, JSON.stringify(record.sourceRefs), input.now] })),
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
      { sql: `UPDATE seller_ai_drafts SET status = 'seller_review', updated_at = ? WHERE session_id = ? AND version = ? AND status = 'draft'`, params: [now, sessionId, version] },
      { sql: `UPDATE seller_ai_creation_sessions SET status = 'seller_review', updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ? AND current_draft_version = ?`, params: [now, sessionId, session.organizationId, session.workspaceId, version] },
    ]);
    if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1) throw new DatabaseError("Seller AI draft is not reviewable");
    const draft = await this.database.first<SellerAIDraftRecord>(`SELECT id, session_id AS sessionId, version, status, draft_json AS draftJson, created_at AS createdAt, updated_at AS updatedAt FROM seller_ai_drafts WHERE session_id = ? AND version = ? LIMIT 1`, sessionId, version);
    if (!draft || draft.status !== "seller_review") throw new DatabaseError("Seller AI draft is not reviewable");
    return draft;
  }

  async confirmDraft(context: RequestContext, sessionId: EntityId, version: number, now: string): Promise<SellerAIDraftRecord> {
    const session = await this.getSession(context, sessionId);
    if (!session) throw new DatabaseError("Seller AI session not found");
    if (session.currentDraftVersion !== version) throw new DatabaseError("Seller AI draft version is stale");
    if (session.status === "confirmed" || session.status === "catalog_saved") {
      const current = await this.database.first<SellerAIDraftRecord>(`SELECT id, session_id AS sessionId, version, status, draft_json AS draftJson, created_at AS createdAt, updated_at AS updatedAt FROM seller_ai_drafts WHERE session_id = ? AND version = ? LIMIT 1`, sessionId, version);
      if (current?.status === "confirmed") return current;
    }
    const results = await this.database.transaction([
      { sql: `UPDATE seller_ai_drafts SET status = 'confirmed', updated_at = ? WHERE session_id = ? AND version = ? AND status = 'seller_review'`, params: [now, sessionId, version] },
      { sql: `UPDATE seller_ai_creation_sessions SET status = 'confirmed', updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ? AND current_draft_version = ?`, params: [now, sessionId, session.organizationId, session.workspaceId, version] },
    ]);
    if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1) throw new DatabaseError("Seller AI draft must be reviewed before confirmation");
    const draft = await this.database.first<SellerAIDraftRecord>(`SELECT id, session_id AS sessionId, version, status, draft_json AS draftJson, created_at AS createdAt, updated_at AS updatedAt FROM seller_ai_drafts WHERE session_id = ? AND version = ? LIMIT 1`, sessionId, version);
    if (!draft || draft.status !== "confirmed") throw new DatabaseError("Seller AI draft must be reviewed before confirmation");
    return draft;
  }

  async markCatalogSaved(context: RequestContext, sessionId: EntityId, version: number, productId: EntityId, now: string): Promise<boolean> {
    const session = await this.getSession(context, sessionId);
    if (!session) throw new DatabaseError("Seller AI session not found");
    const result = await this.database.run(`UPDATE seller_ai_creation_sessions SET status = 'catalog_saved', catalog_product_id = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ? AND current_draft_version = ? AND status IN ('confirmed','catalog_saved')`, productId, now, sessionId, session.organizationId, session.workspaceId, version);
    return result.meta?.changes === undefined ? true : result.meta.changes === 1;
  }

  async cancelSession(context: RequestContext, sessionId: EntityId, now: string): Promise<boolean> {
    const session = await this.getSession(context, sessionId);
    if (!session) throw new DatabaseError("Seller AI session not found");
    if (["published", "cancelled", "expired", "catalog_saved"].includes(session.status)) return false;
    const result = await this.database.run(`UPDATE seller_ai_creation_sessions SET status = 'cancelled', updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ? AND status NOT IN ('published','cancelled','expired','catalog_saved')`, now, sessionId, session.organizationId, session.workspaceId);
    return result.meta?.changes === undefined ? true : result.meta.changes === 1;
  }

  async getDraft(context: RequestContext, sessionId: EntityId): Promise<SellerAIDraftRecord | null> {
    const session = await this.getSession(context, sessionId);
    if (!session || session.currentDraftVersion === 0) return null;
    return this.database.first<SellerAIDraftRecord>(`SELECT id, session_id AS sessionId, version, status, draft_json AS draftJson, created_at AS createdAt, updated_at AS updatedAt FROM seller_ai_drafts WHERE session_id = ? AND version = ? LIMIT 1`, sessionId, session.currentDraftVersion);
  }
}
