import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository, sha256Hex } from "@qooqnos/database";

export type FinancialAuditOutcome = "succeeded" | "failed" | "rejected";

export interface FinancialAuditEventRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly businessId: EntityId | null;
  readonly actorId: EntityId | null;
  readonly eventType: string;
  readonly entityType: string;
  readonly entityId: EntityId;
  readonly outcome: FinancialAuditOutcome;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly reasonCode: string | null;
  readonly reason: string | null;
  readonly source: string;
  readonly requestId: string | null;
  readonly correlationId: string;
  readonly idempotencyKey: string | null;
  readonly before: unknown;
  readonly after: unknown;
  readonly metadata: unknown;
  readonly integrityHash: string;
  readonly occurredAt: string;
  readonly createdAt: string;
}

export interface FinancialAuditAppendInput {
  readonly id: EntityId;
  readonly eventType: string;
  readonly entityType: string;
  readonly entityId: EntityId;
  readonly businessId?: EntityId | undefined;
  readonly outcome: FinancialAuditOutcome;
  readonly amountMinor?: number | undefined;
  readonly currency?: string | undefined;
  readonly reasonCode?: string | undefined;
  readonly reason?: string | undefined;
  readonly source: string;
  readonly requestId?: string | undefined;
  readonly correlationId: string;
  readonly idempotencyKey?: string | undefined;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly metadata?: unknown;
  readonly occurredAt: string;
  readonly now: string;
}

export class FinancialAuditRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async append(
    context: RequestContext,
    input: FinancialAuditAppendInput,
  ): Promise<FinancialAuditEventRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    if (!input.eventType.trim()) throw new DatabaseError("Financial audit event type is required");
    if (!input.entityType.trim()) throw new DatabaseError("Financial audit entity type is required");
    if (!input.source.trim()) throw new DatabaseError("Financial audit source is required");
    if (!Number.isSafeInteger(input.amountMinor ?? 0)) {
      throw new DatabaseError("Financial audit amount must be an integer minor-unit value");
    }
    const currency = input.currency?.trim().toUpperCase();
    if (currency && !/^[A-Z]{3}$/.test(currency)) {
      throw new DatabaseError("Financial audit currency must be a three-letter ISO currency code");
    }

    const beforeJson = serialize(input.before);
    const afterJson = serialize(input.after);
    const metadataJson = serialize(input.metadata);
    const integrityHash = await hashEvent({
      organizationId,
      workspaceId: context.workspaceId ?? null,
      businessId: input.businessId ?? null,
      actorId: context.actorId ?? null,
      eventType: input.eventType.trim(),
      entityType: input.entityType.trim(),
      entityId: input.entityId,
      outcome: input.outcome,
      amountMinor: input.amountMinor ?? null,
      currency: currency ?? null,
      reasonCode: input.reasonCode ?? null,
      reason: input.reason ?? null,
      source: input.source.trim(),
      requestId: input.requestId ?? context.requestId ?? null,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? null,
      beforeJson,
      afterJson,
      metadataJson,
      occurredAt: input.occurredAt,
    });

    await this.database.run(
      `INSERT INTO billing_financial_audit_events
       (id, organization_id, workspace_id, business_id, actor_id, event_type, entity_type, entity_id,
        outcome, amount_minor, currency, reason_code, reason, source, request_id, correlation_id,
        idempotency_key, before_json, after_json, metadata_json, integrity_hash, occurred_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, organizationId, context.workspaceId ?? null, input.businessId ?? null, context.actorId ?? null,
      input.eventType.trim(), input.entityType.trim(), input.entityId, input.outcome,
      input.amountMinor ?? null, currency ?? null, input.reasonCode ?? null, input.reason ?? null,
      input.source.trim(), input.requestId ?? context.requestId ?? null, input.correlationId,
      input.idempotencyKey ?? null, beforeJson, afterJson, metadataJson, integrityHash,
      input.occurredAt, input.now,
    );
    const record = await this.get(context, input.id);
    if (!record) throw new DatabaseError("Financial audit event not found after append");
    return record;
  }

  async get(context: RequestContext, id: EntityId): Promise<FinancialAuditEventRecord | null> {
    return this.database.first<FinancialAuditEventRow>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
              business_id AS businessId, actor_id AS actorId, event_type AS eventType,
              entity_type AS entityType, entity_id AS entityId, outcome,
              amount_minor AS amountMinor, currency, reason_code AS reasonCode, reason,
              source, request_id AS requestId, correlation_id AS correlationId,
              idempotency_key AS idempotencyKey, before_json AS beforeJson,
              after_json AS afterJson, metadata_json AS metadataJson,
              integrity_hash AS integrityHash, occurred_at AS occurredAt, created_at AS createdAt
       FROM billing_financial_audit_events
       WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?)
       LIMIT 1`,
      id, this.requireOrganization({ organizationId: context.tenantId }), context.workspaceId ?? null,
    ).then((row) => row ? mapRecord(row) : null);
  }

  async listForEntity(
    context: RequestContext,
    entityType: string,
    entityId: EntityId,
    limit = 100,
  ): Promise<readonly FinancialAuditEventRecord[]> {
    if (!Number.isInteger(limit) || limit < 1) throw new DatabaseError("Financial audit limit must be positive");
    const rows = await this.database.all<FinancialAuditEventRow>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
              business_id AS businessId, actor_id AS actorId, event_type AS eventType,
              entity_type AS entityType, entity_id AS entityId, outcome,
              amount_minor AS amountMinor, currency, reason_code AS reasonCode, reason,
              source, request_id AS requestId, correlation_id AS correlationId,
              idempotency_key AS idempotencyKey, before_json AS beforeJson,
              after_json AS afterJson, metadata_json AS metadataJson,
              integrity_hash AS integrityHash, occurred_at AS occurredAt, created_at AS createdAt
       FROM billing_financial_audit_events
       WHERE organization_id = ? AND entity_type = ? AND entity_id = ?
         AND (workspace_id IS NULL OR workspace_id = ?)
       ORDER BY occurred_at DESC, id DESC
       LIMIT ?`,
      this.requireOrganization({ organizationId: context.tenantId }),
      entityType.trim(), entityId, context.workspaceId ?? null, Math.min(limit, 500),
    );
    return rows.map(mapRecord);
  }
}

interface FinancialAuditEventRow {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string | null;
  readonly businessId: string | null;
  readonly actorId: string | null;
  readonly eventType: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly outcome: FinancialAuditOutcome;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly reasonCode: string | null;
  readonly reason: string | null;
  readonly source: string;
  readonly requestId: string | null;
  readonly correlationId: string;
  readonly idempotencyKey: string | null;
  readonly beforeJson: string | null;
  readonly afterJson: string | null;
  readonly metadataJson: string | null;
  readonly integrityHash: string;
  readonly occurredAt: string;
  readonly createdAt: string;
}

function mapRecord(row: FinancialAuditEventRow): FinancialAuditEventRecord {
  const { beforeJson, afterJson, metadataJson, ...record } = row;
  return {
    ...record,
    before: parseJson(beforeJson),
    after: parseJson(afterJson),
    metadata: parseJson(metadataJson),
  } as FinancialAuditEventRecord;
}

function serialize(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function parseJson(value: string | null): unknown {
  if (value === null) return null;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}

async function hashEvent(input: Record<string, unknown>): Promise<string> {
  return sha256Hex(JSON.stringify(input));
}
