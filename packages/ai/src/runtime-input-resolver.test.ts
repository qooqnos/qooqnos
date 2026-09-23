import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { createSellerProductAIRuntimeInputResolver } from "./runtime-input-resolver";
import type { AiOperationRecord } from "./runtime-repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("request-1"),
    correlationId: brandId<"CorrelationId">("correlation-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "ai",
    operation: "ai.worker.execute",
    locale: "en",
    timezone: "UTC",
    authenticated: true,
  };
}

function operation(overrides: Partial<AiOperationRecord> = {}): AiOperationRecord {
  return {
    id: brandId<"EntityId">("operation-1"),
    organizationId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    actorId: brandId<"EntityId">("user-1"),
    sessionId: brandId<"EntityId">("session-1"),
    operationType: "seller.product.extract",
    operationVersion: 1,
    requestId: "request-1",
    correlationId: "correlation-1",
    idempotencyKey: "idem-1",
    status: "started",
    inputReference: "input-1",
    outputReference: null,
    workerLeaseUntil: null,
    workerClaimedBy: "worker-1",
    workerAttempts: 1,
    createdAt: "2026-09-23T00:00:00.000Z",
    updatedAt: "2026-09-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("createSellerProductAIRuntimeInputResolver", () => {
  it("rebuilds a Seller AI runtime request from persisted session/input state", async () => {
    const resolver = createSellerProductAIRuntimeInputResolver({
      repository: {
        async getSession() {
          return {
            id: brandId<"EntityId">("session-1"),
            organizationId: brandId<"EntityId">("tenant-1"),
            workspaceId: brandId<"EntityId">("workspace-1"),
            businessId: brandId<"EntityId">("business-1"),
            catalogProductId: null,
            actorId: brandId<"EntityId">("user-1"),
            status: "open",
            currentDraftVersion: 0,
            idempotencyKey: "idem-1",
            requestFingerprint: "fp-1",
            requestId: "request-1",
            correlationId: "correlation-1",
            expiresAt: null,
            createdAt: "2026-09-23T00:00:00.000Z",
            updatedAt: "2026-09-23T00:00:00.000Z",
          };
        },
        async getInputs() {
          return [
            {
              id: brandId<"EntityId">("input-1"),
              sessionId: brandId<"EntityId">("session-1"),
              mediaAssetId: brandId<"EntityId">("media-1"),
              rawText: "Blue shirt",
              inputHash: "hash-1",
              createdAt: "2026-09-23T00:00:00.000Z",
            },
          ];
        },
      } as never,
    });

    const result = await resolver.resolve(operation(), context());
    expect(result.operationType).toBe("seller.product.extract");
    expect(result.businessId).toBe("business-1");
    expect(result.sessionId).toBe("session-1");
    expect(result.input).toMatchObject({
      sessionId: "session-1",
      inputs: [{ id: "input-1", rawText: "Blue shirt" }],
    });
  });

  it("fails closed for unsupported operation types", async () => {
    const resolver = createSellerProductAIRuntimeInputResolver({ repository: {} as never });
    await expect(
      resolver.resolve(
        operation({ operationType: "unsupported.operation" }),
        context(),
      ),
    ).rejects.toThrow("No durable AI input resolver");
  });
});
