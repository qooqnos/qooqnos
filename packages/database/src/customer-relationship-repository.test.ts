import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { CustomerRelationshipRepository } from "./customer-relationship-repository";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "./client";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "crm",
    operation: "crm.relationship.read",
    locale: "en",
    timezone: "UTC",
  };
}

describe("CustomerRelationshipRepository", () => {
  it("enforces tenant and workspace scope on relationship reads", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch() { return []; },
    };
    const repository = new CustomerRelationshipRepository(new D1Database(raw));

    const result = await repository.get(context(), brandId<"EntityId">("relationship-foreign"));

    expect(result).toBeNull();
    expect(statements[0]).toContain("c.organization_id = ?");
    expect(statements[0]).toContain("b.workspace_id = ?");
  });

  it("rejects relationship creation when customer or business is outside the workspace", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new CustomerRelationshipRepository(new D1Database(raw));

    await expect(repository.create(context(), {
      id: brandId<"EntityId">("relationship-1"),
      customerId: brandId<"EntityId">("customer-foreign"),
      businessId: brandId<"EntityId">("business-foreign"),
      relationshipType: "prospect",
      source: "discovery",
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("not available in the current workspace");
  });
  it("rejects a stale relationship status transition", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return {
          id: "relationship-1",
          organizationId: "tenant-1",
          workspaceId: "workspace-1",
          customerId: "customer-1",
          businessId: "business-1",
          relationshipType: "match",
          status: "prospect",
          firstInteractionAt: null,
          lastInteractionAt: null,
          source: "matching",
          createdAt: "2026-09-23T00:00:00.000Z",
          updatedAt: "2026-09-23T00:00:00.000Z",
        } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true, meta: { changes: 0 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new CustomerRelationshipRepository(new D1Database(raw));

    await expect(repository.setStatus(
      context(),
      brandId<"EntityId">("relationship-1"),
      "active",
      "2026-09-23T00:01:00.000Z",
    )).rejects.toThrow("changed concurrently");
  });

  it("keeps interaction timestamps monotonic in the database", async () => {
    const queries: Array<{ sql: string; params: readonly unknown[] }> = [];
    const record = {
      id: "relationship-1",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      customerId: "customer-1",
      businessId: "business-1",
      relationshipType: "match",
      status: "prospect",
      firstInteractionAt: "2026-09-20T00:00:00.000Z",
      lastInteractionAt: "2026-09-22T00:00:00.000Z",
      source: "matching",
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    };
    const statement: D1PreparedStatementLike = {
      bind(...values) {
        queries.push({ sql: queries[queries.length - 1]?.sql ?? "", params: values });
        return this;
      },
      async first<T>() { return record as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) {
        queries.push({ sql, params: [] });
        return statement;
      },
      async batch() { return []; },
    };
    const repository = new CustomerRelationshipRepository(new D1Database(raw));

    await repository.recordInteraction(
      context(),
      brandId<"EntityId">("relationship-1"),
      "2026-09-19T00:00:00.000Z",
      "2026-09-23T00:00:00.000Z",
    );

    const update = queries.find((query) => query.sql.includes("first_interaction_at = CASE"));
    expect(update?.sql).toContain("last_interaction_at = CASE");
    expect(update?.params[0]).toBe("2026-09-19T00:00:00.000Z");
  });

});
