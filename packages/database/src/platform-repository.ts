import { DatabaseError, D1Database, Repository, RepositoryContext } from "./client";

export interface AuditEventInput {
  readonly id: string;
  readonly actorId?: string;
  readonly action: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly outcome: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface OutboxEventInput {
  readonly id: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly aggregateType?: string;
  readonly aggregateId?: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly availableAt: string;
  readonly occurredAt: string;
}

/** Canonical persistence boundary for platform audit, idempotency and outbox state. */
export class PlatformRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async appendAudit(context: RepositoryContext, input: AuditEventInput): Promise<void> {
    const organizationId = context.organizationId ?? null;
    const workspaceId = context.workspaceId ?? null;
    await this.database.run(
      `INSERT INTO audit_events
       (id, actor_id, organization_id, workspace_id, action, target_type, target_id, outcome, request_id, correlation_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id,
      input.actorId ?? null,
      organizationId,
      workspaceId,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      input.outcome,
      input.requestId ?? null,
      input.correlationId ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.createdAt,
    );
  }

  async getIdempotency(context: RepositoryContext, key: string): Promise<import("./command-repository").IdempotencyRecord | null> {
    const scope = this.scope(context);
    return this.database.first<import("./command-repository").IdempotencyRecord>(
      `SELECT scope, key, request_fingerprint AS requestFingerprint, status,
              result_json AS resultJson, created_at AS createdAt, expires_at AS expiresAt
       FROM idempotency_records WHERE scope = ? AND key = ? LIMIT 1`,
      scope,
      key,
    );
  }

  async beginIdempotency(context: RepositoryContext, key: string, requestFingerprint: string, createdAt: string, expiresAt: string): Promise<boolean> {
    const scope = this.scope(context);
    try {
      await this.database.run(
        `INSERT INTO idempotency_records (scope, key, request_fingerprint, status, result_json, created_at, expires_at)
         VALUES (?, ?, ?, 'processing', NULL, ?, ?)`,
        scope,
        key,
        requestFingerprint,
        createdAt,
        expiresAt,
      );
      return true;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      return false;
    }
  }

  async completeIdempotency(context: RepositoryContext, key: string, requestFingerprint: string, status: "succeeded" | "failed", result: unknown): Promise<void> {
    const scope = this.scope(context);
    const resultJson = JSON.stringify(result);
    const updated = await this.database.run(
      `UPDATE idempotency_records SET status = ?, result_json = ?
       WHERE scope = ? AND key = ? AND request_fingerprint = ? AND status = 'processing'`,
      status,
      resultJson,
      scope,
      key,
      requestFingerprint,
    );
    if ((updated.meta?.changes ?? 0) !== 1) throw new DatabaseError("Idempotency record is missing or has a different request fingerprint");
  }

  async appendOutbox(context: RepositoryContext, input: OutboxEventInput): Promise<void> {
    await this.database.run(
      `INSERT INTO outbox_events
       (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)`,
      input.id,
      input.eventType,
      input.eventVersion,
      input.aggregateType ?? null,
      input.aggregateId ?? null,
      context.organizationId ?? null,
      context.workspaceId ?? null,
      JSON.stringify(input.payload),
      input.availableAt,
      input.occurredAt,
    );
  }

  private scope(context: RepositoryContext): string {
    if (context.workspaceId) return `workspace:${context.workspaceId}`;
    if (context.organizationId) return `organization:${context.organizationId}`;
    throw new DatabaseError("Organization or workspace context is required");
  }
}
