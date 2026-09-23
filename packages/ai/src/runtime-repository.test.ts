import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { AiRuntimeRepository } from "./runtime-repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "ai",
    operation: "ai.runtime.manage",
    locale: "en",
    timezone: "UTC",
  };
}

function repositoryWithStatus(status: "failed" | "succeeded") {
  const statement: D1PreparedStatementLike = {
    bind() { return this; },
    async first<T>() {
      return {
        id: "operation-1",
        organizationId: "tenant-1",
        workspaceId: "workspace-1",
        operationType: "seller.product.extract",
        operationVersion: 1,
        requestId: "req-1",
        correlationId: "corr-1",
        idempotencyKey: "idem-1",
        status,
        inputReference: null,
        outputReference: null,
        createdAt: "2026-09-23T00:00:00.000Z",
        updatedAt: "2026-09-23T00:01:00.000Z",
      } as T;
    },
    async all<T>() { return { results: [] as T[] }; },
    async run() { return { success: true }; },
  };
  const raw: D1DatabaseLike = {
    prepare() { return statement; },
    async batch() { return []; },
  };
  return new AiRuntimeRepository(new D1Database(raw));
}

describe("AiRuntimeRepository", () => {
  it("does not reopen a failed AI operation", async () => {
    const repository = repositoryWithStatus("failed");

    await expect(repository.setOperationStatus(
      context(),
      brandId<"EntityId">("operation-1"),
      "started",
      "2026-09-23T00:02:00.000Z",
    )).rejects.toThrow("cannot be reopened");
  });

  it("does not reopen a succeeded AI operation", async () => {
    const repository = repositoryWithStatus("succeeded");

    await expect(repository.setOperationStatus(
      context(),
      brandId<"EntityId">("operation-1"),
      "started",
      "2026-09-23T00:02:00.000Z",
    )).rejects.toThrow("cannot be reopened");
  });
});
