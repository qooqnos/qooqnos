import { DatabaseError, D1Database } from "./client";

export interface IdempotencyRecord {
  scope: string;
  key: string;
  requestFingerprint: string;
  status: "running" | "succeeded" | "failed";
  resultJson?: string | null;
}

export class IdempotencyService {
  constructor(private readonly database: D1Database) {}

  async claim(scope: string, key: string, requestFingerprint: string): Promise<boolean> {
    const existing = await this.database.first<IdempotencyRecord>(
      `SELECT scope, key, request_fingerprint AS requestFingerprint, status, result_json AS resultJson
       FROM idempotency_records WHERE scope = ? AND key = ?`,
      scope, key,
    );
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) {
        throw new DatabaseError("Idempotency key reused with a different request");
      }
      return false;
    }
    await this.database.run(
      `INSERT INTO idempotency_records (scope, key, request_fingerprint, status)
       VALUES (?, ?, ?, 'running')`,
      scope, key, requestFingerprint,
    );
    const inserted = await this.database.first<IdempotencyRecord>(
      `SELECT scope, key, request_fingerprint AS requestFingerprint, status, result_json AS resultJson
       FROM idempotency_records WHERE scope = ? AND key = ?`,
      scope, key,
    );
    if (!inserted) throw new DatabaseError("Idempotency claim disappeared after atomic claim");
    if (inserted.requestFingerprint !== requestFingerprint) {
      throw new DatabaseError("Idempotency key reused with a different request");
    }
    return true;
  }

  async complete(scope: string, key: string, status: "succeeded" | "failed", resultJson?: string): Promise<void> {
    await this.database.run(
      `UPDATE idempotency_records SET status = ?, result_json = ? WHERE scope = ? AND key = ?`,
      status, resultJson ?? null, scope, key,
    );
  }
}

export interface OutboxInput {
  id: string;
  eventType: string;
  eventVersion: number;
  aggregateType?: string | undefined;
  aggregateId?: string | undefined;
  organizationId?: string | undefined;
  workspaceId?: string | undefined;
  payloadJson: string;
  availableAt: string;
  occurredAt: string;
}

export interface OutboxEventRecord extends OutboxInput {
  status: "pending" | "published" | "failed";
  attempts: number;
  publishedAt: string | null;
}

interface OutboxEventRow {
  id: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string | null;
  aggregateId: string | null;
  organizationId: string | null;
  workspaceId: string | null;
  payloadJson: string;
  status: "pending" | "published" | "failed";
  attempts: number;
  availableAt: string;
  occurredAt: string;
  publishedAt: string | null;
}

export class OutboxService {
  constructor(private readonly database: D1Database) {}

  async enqueue(event: OutboxInput): Promise<void> {
    await this.database.run(
      `INSERT INTO outbox_events
       (id, event_type, event_version, aggregate_type, aggregate_id,
        organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      event.id, event.eventType, event.eventVersion, event.aggregateType ?? null, event.aggregateId ?? null,
      event.organizationId ?? null, event.workspaceId ?? null, event.payloadJson, event.availableAt, event.occurredAt,
    );
  }

  async listPending(now: string, limit = 50): Promise<OutboxEventRecord[]> {
    if (!Number.isInteger(limit) || limit < 1) throw new DatabaseError("Outbox limit must be a positive integer");
    const rows = await this.database.all<OutboxEventRow>(
      `SELECT id, event_type AS eventType, event_version AS eventVersion,
              aggregate_type AS aggregateType, aggregate_id AS aggregateId,
              organization_id AS organizationId, workspace_id AS workspaceId,
              payload_json AS payloadJson, status, attempts,
              available_at AS availableAt, occurred_at AS occurredAt,
              published_at AS publishedAt
       FROM outbox_events
       WHERE status = 'pending' AND available_at <= ?
       ORDER BY available_at ASC, occurred_at ASC, id ASC
       LIMIT ?`,
      now, Math.min(limit, 100),
    );
    return rows.map((row) => {
      const { aggregateType, aggregateId, organizationId, workspaceId, ...base } = row;
      return {
        ...base,
        ...(aggregateType === null ? {} : { aggregateType }),
        ...(aggregateId === null ? {} : { aggregateId }),
        ...(organizationId === null ? {} : { organizationId }),
        ...(workspaceId === null ? {} : { workspaceId }),
      };
    });
  }

  async markPublished(id: string, publishedAt: string): Promise<void> {
    await this.database.run(
      `UPDATE outbox_events
       SET status = 'published', published_at = ?, attempts = attempts + 1
       WHERE id = ? AND status = 'pending'`,
      publishedAt, id,
    );
  }

  async markFailed(id: string): Promise<void> {
    await this.database.run(
      `UPDATE outbox_events
       SET status = 'failed', attempts = attempts + 1
       WHERE id = ? AND status = 'pending'`,
      id,
    );
  }
}
