import { describe, expect, it } from "vitest";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "./client";
import { CatalogCommandRepository } from "./catalog-command-repository";

function createDatabase(): {
  database: D1Database;
  batches: Array<Array<{ sql: string; params: readonly unknown[] }>>;
} {
  const batches: Array<Array<{ sql: string; params: readonly unknown[] }>> = [];
  const db: D1DatabaseLike = {
    prepare(sql: string): D1PreparedStatementLike {
      void sql;
      return {
        bind(...values: unknown[]) {
          void values;
          return {
            bind: (...next: unknown[]) => this.bind(...next),
            first: async () => null,
            all: async () => ({ results: [] }),
            run: async () => ({ success: true, meta: { changes: 1 } }),
          } as D1PreparedStatementLike;
        },
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ success: true, meta: { changes: 1 } }),
      } as D1PreparedStatementLike;
    },
    async batch(statements) {
      batches.push(statements.map(() => ({ sql: "", params: [] })));
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
  return { database: new D1Database(db), batches };
}

describe("CatalogCommandRepository", () => {
  it("persists product, audit, outbox and idempotency in one batch", async () => {
    const { database, batches } = createDatabase();
    const repository = new CatalogCommandRepository(database);
    const result = await repository.createProduct({
      context: {
        requestId: "req_1" as never,
        correlationId: "cor_1" as never,
        tenantId: "org_1" as never,
        workspaceId: "ws_1" as never,
        actorId: "user_1" as never,
        module: "catalog",
        operation: "product.create",
        locale: "en-US",
        timezone: "UTC",
      },
      id: "product_1" as never,
      businessId: "business_1" as never,
      name: "Test product",
      now: "2026-09-15T09:00:00.000Z",
      expiresAt: "2026-09-15T10:00:00.000Z",
      idempotencyKey: "idem_1",
      requestFingerprint: "fingerprint_1",
      auditId: "audit_1",
      eventId: "event_1",
    });

    expect(result.kind).toBe("executed");
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(5);
  });
});
