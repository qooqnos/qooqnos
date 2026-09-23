import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { DiscoveryRepository } from "./repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "discovery",
    operation: "discovery.index.manage",
    locale: "en",
    timezone: "UTC",
  };
}

function database<T>(first: T | null = null): D1Database {
  const statement: D1PreparedStatementLike = {
    bind() { return this; },
    async first<U>() { return first as U | null; },
    async all<U>() { return { results: [] as U[] }; },
    async run() { return { success: true }; },
  };
  const raw: D1DatabaseLike = {
    prepare() { return statement; },
    async batch() { return []; },
  };
  return new D1Database(raw);
}

describe("Discovery index observability", () => {
  it("rejects non-positive index generations", async () => {
    const repository = new DiscoveryRepository(database());

    await expect(repository.createIndexVersion(context(), {
      id: brandId<"EntityId">("index-1"),
      generation: 0,
      indexSchemaVersion: "search-v1",
      createdBy: "system",
      now: "2026-09-23T00:00:00.000Z",
    })).rejects.toThrow("generation must be positive");
  });

  it("records query-trace evidence with tenant/workspace scope", async () => {
    const row = {
      id: "trace-1",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      requestId: "req-1",
      rankingPolicyVersion: "ranking-v1",
      cacheStatus: "miss",
      latencyMs: 12,
      degradationState: null,
      createdAt: "2026-09-23T00:00:00.000Z",
    };
    const repository = new DiscoveryRepository(database(row));

    const result = await repository.recordQueryTrace(context(), {
      id: brandId<"EntityId">("trace-1"),
      requestId: "req-1",
      rankingPolicyVersion: "ranking-v1",
      cacheStatus: "miss",
      latencyMs: 12,
      resultIds: [brandId<"EntityId">("candidate-1")],
      now: "2026-09-23T00:00:00.000Z",
    });

    expect(result.organizationId).toBe("tenant-1");
    expect(result.workspaceId).toBe("workspace-1");
  });
});
