import { describe, expect, it } from "vitest";
import { CommandRepository } from "./command-repository";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike, type D1ResultLike } from "./client";

function databaseWithState(initial: Record<string, unknown> = {}) {
  const state = new Map(Object.entries(initial));
  const statements: string[] = [];
  const db: D1DatabaseLike = {
    prepare(query) {
      const statement: D1PreparedStatementLike = {
        bind(...values) {
          (statement as D1PreparedStatementLike & { values: unknown[] }).values = values;
          return statement;
        },
        async first<T>() {
          if (query.includes("FROM idempotency_records")) {
            const key = (statement as D1PreparedStatementLike & { values: unknown[] }).values[1] as string;
            const record = state.get(`idempotency:${key}`) as T | undefined;
            return record ?? null;
          }
          return null;
        },
        async all<T>() {
          return { results: [] as T[] };
        },
        async run(): Promise<D1ResultLike> {
          statements.push(query);
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
    async batch(batch) {
      for (const statement of batch) await statement.run();
      return batch.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
  return { database: new D1Database(db), statements };
}

describe("CommandRepository", () => {
  it("builds one atomic batch containing idempotency, command, audit, outbox and completion", async () => {
    const { database, statements } = databaseWithState();
    const repository = new CommandRepository(database);

    const result = await repository.execute(
      { organizationId: "org-1", workspaceId: "ws-1" },
      {
        key: "request-1",
        requestFingerprint: "fingerprint-1",
        createdAt: "2026-09-15T09:00:00.000Z",
        expiresAt: "2026-09-16T09:00:00.000Z",
        result: { id: "entity-1" },
        statements: [{ sql: "INSERT INTO example (id) VALUES (?)", params: ["entity-1"] }],
        audit: { id: "audit-1", action: "example.created", outcome: "success" },
        outbox: [{
          id: "event-1",
          eventType: "example.created",
          eventVersion: 1,
          aggregateType: "example",
          aggregateId: "entity-1",
          payload: { id: "entity-1" },
          availableAt: "2026-09-15T09:00:00.000Z",
          occurredAt: "2026-09-15T09:00:00.000Z",
        }],
      },
    );

    expect(result).toEqual({ kind: "executed", result: { id: "entity-1" } });
    expect(statements).toHaveLength(5);
    expect(statements[0]).toContain("INSERT INTO idempotency_records");
    expect(statements[1]).toContain("INSERT INTO example");
    expect(statements[2]).toContain("INSERT INTO audit_events");
    expect(statements[3]).toContain("INSERT INTO outbox_events");
    expect(statements[4]).toContain("UPDATE idempotency_records");
  });

  it("rejects an idempotency key when the fingerprint differs", async () => {
    const { database } = databaseWithState({
      "idempotency:request-1": {
        requestFingerprint: "other-fingerprint",
        status: "succeeded",
        resultJson: JSON.stringify({ id: "entity-1" }),
        expiresAt: "2026-09-16T09:00:00.000Z",
      },
    });
    const repository = new CommandRepository(database);

    await expect(repository.execute(
      { organizationId: "org-1" },
      {
        key: "request-1",
        requestFingerprint: "fingerprint-1",
        createdAt: "2026-09-15T09:00:00.000Z",
        expiresAt: "2026-09-16T09:00:00.000Z",
        result: { id: "entity-1" },
        statements: [],
        audit: { id: "audit-1", action: "example.created", outcome: "success" },
      },
    )).rejects.toThrow("different request fingerprint");
  });
});
