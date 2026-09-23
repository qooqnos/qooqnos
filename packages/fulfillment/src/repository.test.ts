import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { FulfillmentRepository } from "./repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "fulfillment",
    operation: "fulfillment.create",
    locale: "en",
    timezone: "UTC",
  };
}

describe("FulfillmentRepository", () => {
  it("returns the existing fulfillment for repeated commitment intake", async () => {
    const existing = {
      id: "fulfillment-1",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      businessId: "business-1",
      sourceType: "commerce_order",
      sourceId: "order-1",
      status: "pending",
      fulfillmentType: "physical",
      planId: null,
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
      completedAt: null,
      cancelledAt: null,
    };
    let writes = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return existing as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { writes += 1; return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new FulfillmentRepository(new D1Database(raw));

    const result = await repository.createFromCommitment(context(), {
      id: brandId<"EntityId">("fulfillment-new"),
      sourceType: "commerce_order",
      sourceId: brandId<"EntityId">("order-1"),
      businessId: brandId<"EntityId">("business-1"),
      fulfillmentType: "physical",
      now: "2026-09-22T00:01:00.000Z",
    });

    expect(result.id).toBe("fulfillment-1");
    expect(writes).toBe(0);
  });

  it("rejects an invalid lifecycle transition", async () => {
    const current = {
      id: "fulfillment-1",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      businessId: "business-1",
      sourceType: "commerce_order",
      sourceId: "order-1",
      status: "pending",
      fulfillmentType: "physical",
      planId: null,
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
      completedAt: null,
      cancelledAt: null,
    };
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return current as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new FulfillmentRepository(new D1Database(raw));

    await expect(repository.setStatus(
      context(),
      brandId<"EntityId">("fulfillment-1"),
      "completed",
      "2026-09-22T00:02:00.000Z",
    )).rejects.toThrow("Invalid FulfillmentOrder status transition");
  });
});
