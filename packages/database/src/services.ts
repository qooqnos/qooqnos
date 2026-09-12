import { D1Database, DatabaseError } from "./index";

export interface AuditInput {
  id: string;
  actorId?: string;
  organizationId?: string;
  workspaceId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  outcome: "success" | "failure" | "denied";
  requestId?: string;
  correlationId?: string;
  metadataJson?: string;
  createdAt: string;
}

export class AuditService {
  constructor(private readonly database: D1Database) {}

  async append(event: AuditInput): Promise<void> {
    await this.database.run(
      `INSERT INTO audit_events
       (id, actor_id, organization_id, workspace_id, action, target_type, target_id,
        outcome, request_id, correlation_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      event.id,
      event.actorId ?? null,
      event.organizationId ?? null,
      event.workspaceId ?? null,
      event.action,
      event.targetType ?? null,
      event.targetId ?? null,
      event.outcome,
      event.requestId ?? null,
      event.correlationId ?? null,
      event.metadataJson ?? null,
      event.createdAt,
    );
  }
}

export interface IdempotencyClaim {
  scope: string;
  key: string;
  requestFingerprint: string;
  createdAt: string;
  expiresAt: string;
}

export class IdempotencyService {
  constructor(private readonly database: D1Database) {}

  async claim(input: IdempotencyClaim): Promise<boolean> {
    const existing = await this.database.first<{ request_fingerprint: string; status: string }>(
      `SELECT request_fingerprint, status
       FROM idempotency_records
       WHERE scope = ? AND key = ? AND expires_at > ?`,
      input.scope,
      input.key,
      input.createdAt,
    );

    if (existing) {
      if (existing.request_fingerprint !== input.requestFingerprint) {
        throw new DatabaseError("Idempotency key reused with a different request");
      }
      return false;
    }

    try {
      await this.database.run(
        `INSERT INTO idempotency_records
         (scope, key, request_fingerprint, status, created_at, expires_at)
         VALUES (?, ?, ?, 'processing', ?, ?)`,
        input.scope,
        input.key,
        input.requestFingerprint,
        input.createdAt,
        input.expiresAt,
      );
      return true;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError("Unable to claim idempotency key", { cause: error });
    }
  }

  async complete(scope: string, key: string, status: "succeeded" | "failed", resultJson?: string): Promise<void> {
    await this.database.run(
      `UPDATE idempotency_records
       SET status = ?, result_json = ?
       WHERE scope = ? AND key = ?`,
      status,
      resultJson ?? null,
      scope,
      key,
    );
  }
}

export interface OutboxInput {
  id: string;
  eventType: string;
  eventVersion: number;
  aggregateType?: string;
  aggregateId?: string;
  organizationId?: string;
  workspaceId?: string;
  payloadJson: string;
  availableAt: string;
  occurredAt: string;
}

export class OutboxService {
  constructor(private readonly database: D1Database) {}

  async enqueue(event: OutboxInput): Promise<void> {
    await this.database.run(
      `INSERT INTO outbox_events
       (id, event_type, event_version, aggregate_type, aggregate_id,
        organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      event.id,
      event.eventType,
      event.eventVersion,
      event.aggregateType ?? null,
      event.aggregateId ?? null,
      event.organizationId ?? null,
      event.workspaceId ?? null,
      event.payloadJson,
      event.availableAt,
      event.occurredAt,
    );
  }
}
