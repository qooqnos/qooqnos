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
});
