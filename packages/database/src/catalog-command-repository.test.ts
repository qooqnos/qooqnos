import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "./client";
import { CatalogCommandRepository } from "./catalog-command-repository";

function database(): { database: D1Database; batches: Array<Array<{ sql: string; params: readonly unknown[] }>> } {
  const batches: Array<Array<{ sql: string; params: readonly unknown[] }>> = [];
  const db: D1DatabaseLike = {
    prepare(sql: string): D1PreparedStatementLike {
      return {
        bind(...values: unknown[]) {
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
      batches.push(statements.map((statement) => ({ sql: "", params: [] })));
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
  return { database: new D1Database(db), batches };
}

describe("CatalogCommandRepository", () => {
  it("persists product, audit, outbox and idempotency in one batch", async () => {
    const { database, batches } = database();
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

    assert.equal(result.kind, "executed");
    assert.equal(batches.length, 1);
    assert.equal(batches[0]?.length, 5);
  });
});
