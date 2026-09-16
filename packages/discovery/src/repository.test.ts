import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { DiscoveryRepository } from "./repository";

function context(tenant = "tenant-1", workspace = "workspace-1"): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">(tenant),
    workspaceId: brandId<"EntityId">(workspace),
    module: "discovery",
    operation: "discovery.search",
    locale: "en",
    timezone: "UTC",
  };
}

function createDatabase(results: unknown[] = []) {
  const calls: unknown[][] = [];
  const statement: D1PreparedStatementLike = {
    bind(...values: unknown[]) { calls.push(values); return this; },
    async first<T>() { return null as T | null; },
    async all<T>() { return { results: results as T[] }; },
    async run() { return { success: true }; },
  };
  const raw: D1DatabaseLike = {
    prepare() { return statement; },
    async batch() { return []; },
  };
  return { database: new D1Database(raw), calls };
}

describe("DiscoveryRepository search", () => {
  it("enforces tenant/workspace scope and eligible projection filtering", async () => {
    const { database, calls } = createDatabase([
      {
        id: "doc-1", organizationId: "tenant-1", workspaceId: "workspace-1",
        sourceType: "product", sourceId: "product-1", documentVersion: 1,
        title: "Product", body: "Body", metadataJson: null,
        eligibility: "eligible", createdAt: "2026-09-16T00:00:00.000Z", updatedAt: "2026-09-16T00:00:00.000Z",
      },
    ]);

    const result = await new DiscoveryRepository(database).search({ context: context(), query: "Product", limit: 10, offset: 0 });

    expect(result).toHaveLength(1);
    expect(result[0]?.organizationId).toBe("tenant-1");
    expect(result[0]?.workspaceId).toBe("workspace-1");
    expect(calls[0]).toEqual(["tenant-1", "workspace-1", "%Product%", "%Product%", "Product%", 10, 0]);
  });

  it("escapes LIKE wildcards instead of treating user input as patterns", async () => {
    const { database, calls } = createDatabase([]);

    await new DiscoveryRepository(database).search({ context: context(), query: "50%_off\\deal" });

    expect(calls[0]).toEqual(["tenant-1", "workspace-1", "%50\\%\\_off\\\\deal%", "%50\\%\\_off\\\\deal%", "50\\%\\_off\\\\deal%", 20, 0]);
  });

  it("does not broaden an empty query beyond the current tenant/workspace", async () => {
    const { database, calls } = createDatabase([]);

    await new DiscoveryRepository(database).search({ context: context("tenant-2", "workspace-9") });

    expect(calls[0]).toEqual(["tenant-2", "workspace-9", 20, 0]);
  });
});
