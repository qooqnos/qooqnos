import { DatabaseError, D1Database, Repository, RepositoryContext } from "./client";

export interface CommandStatement {
  readonly sql: string;
  readonly params?: readonly unknown[];
}

export interface IdempotencyRecord {
  readonly scope: string;
  readonly key: string;
  readonly requestFingerprint: string;
  readonly status: "processing" | "succeeded" | "failed";
  readonly resultJson: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface AtomicCommandInput<TResult> {
  readonly key: string;
  readonly requestFingerprint: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly result: TResult;
  readonly statements: readonly CommandStatement[];
  readonly audit: {
    readonly id: string;
    readonly actorId?: string;
    readonly action: string;
    readonly targetType?: string;
    readonly targetId?: string;
    readonly outcome: string;
    readonly requestId?: string;
    readonly correlationId?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  };
  readonly outbox?: readonly {
    readonly id: string;
    readonly eventType: string;
    readonly eventVersion: number;
    readonly aggregateType?: string;
    readonly aggregateId?: string;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly availableAt: string;
    readonly occurredAt: string;
  }[];
}

export type AtomicCommandResult<TResult> =
  | { readonly kind: "executed"; readonly result: TResult }
  | { readonly kind: "replayed"; readonly result: TResult };

/**
 * Canonical atomic write boundary for commands that must persist domain state,
 * audit, outbox and idempotency state together in one D1 batch.
 */
export class CommandRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async execute<TResult>(
    context: RepositoryContext,
    input: AtomicCommandInput<TResult>,
  ): Promise<AtomicCommandResult<TResult>> {
    if (!input.key.trim()) throw new DatabaseError("Idempotency key cannot be empty");
    if (!input.requestFingerprint.trim()) throw new DatabaseError("Request fingerprint cannot be empty");

    const scope = this.scope(context);
    const existing = await this.database.first<IdempotencyRecord>(
      `SELECT scope, key, request_fingerprint AS requestFingerprint, status,
              result_json AS resultJson, created_at AS createdAt, expires_at AS expiresAt
       FROM idempotency_records
       WHERE scope = ? AND key = ?
       LIMIT 1`,
      scope,
      input.key,
    );

    if (existing) return this.replayOrReject(existing, input.requestFingerprint);

    const statements: CommandStatement[] = [
      {
        sql: `INSERT INTO idempotency_records
              (scope, key, request_fingerprint, status, result_json, created_at, expires_at)
              VALUES (?, ?, ?, 'processing', NULL, ?, ?)`,
        params: [scope, input.key, input.requestFingerprint, input.createdAt, input.expiresAt],
      },
      ...input.statements,
      {
        sql: `INSERT INTO audit_events
              (id, actor_id, organization_id, workspace_id, action, target_type, target_id,
               outcome, request_id, correlation_id, metadata_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          input.audit.id,
          input.audit.actorId ?? null,
          context.organizationId ?? null,
          context.workspaceId ?? null,
          input.audit.action,
          input.audit.targetType ?? null,
          input.audit.targetId ?? null,
          input.audit.outcome,
          input.audit.requestId ?? null,
          input.audit.correlationId ?? null,
          input.audit.metadata ? JSON.stringify(input.audit.metadata) : null,
          input.createdAt,
        ],
      },
      ...this.outboxStatements(context, input.outbox ?? []),
      {
        sql: `UPDATE idempotency_records
              SET status = 'succeeded', result_json = ?
              WHERE scope = ? AND key = ? AND request_fingerprint = ? AND status = 'processing'`,
        params: [JSON.stringify(input.result), scope, input.key, input.requestFingerprint],
      },
    ];

    try {
      await this.database.transaction(statements);
      return { kind: "executed", result: input.result };
    } catch (error) {
      const concurrent = await this.database.first<IdempotencyRecord>(
        `SELECT scope, key, request_fingerprint AS requestFingerprint, status,
                result_json AS resultJson, created_at AS createdAt, expires_at AS expiresAt
         FROM idempotency_records
         WHERE scope = ? AND key = ?
         LIMIT 1`,
        scope,
        input.key,
      );
      if (concurrent) return this.replayOrReject(concurrent, input.requestFingerprint);
      throw error;
    }
  }

  private replayOrReject<TResult>(existing: IdempotencyRecord, requestFingerprint: string): AtomicCommandResult<TResult> {
    if (existing.requestFingerprint !== requestFingerprint) {
      throw new DatabaseError("Idempotency key is already bound to a different request fingerprint");
    }
    if (existing.status === "succeeded" && existing.resultJson !== null) {
      return { kind: "replayed", result: JSON.parse(existing.resultJson) as TResult };
    }
    if (Date.parse(existing.expiresAt) <= Date.now()) {
      throw new DatabaseError("Idempotency record has expired and must be explicitly reclaimed");
    }
    throw new DatabaseError(`Idempotent command is currently ${existing.status}`);
  }

  private outboxStatements(
    context: RepositoryContext,
    events: NonNullable<AtomicCommandInput<unknown>["outbox"]>,
  ): CommandStatement[] {
    return events.map((event) => ({
      sql: `INSERT INTO outbox_events
            (id, event_type, event_version, aggregate_type, aggregate_id,
             organization_id, workspace_id, payload_json, status, attempts,
             available_at, occurred_at, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)`,
      params: [
        event.id,
        event.eventType,
        event.eventVersion,
        event.aggregateType ?? null,
        event.aggregateId ?? null,
        context.organizationId ?? null,
        context.workspaceId ?? null,
        JSON.stringify(event.payload),
        event.availableAt,
        event.occurredAt,
      ],
    }));
  }

  private scope(context: RepositoryContext): string {
    if (context.workspaceId) return `workspace:${context.workspaceId}`;
    if (context.organizationId) return `organization:${context.organizationId}`;
    throw new DatabaseError("Organization or workspace context is required");
  }
}
