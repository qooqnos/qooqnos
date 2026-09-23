import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { createPersistentAIRuntimeClient } from "./runtime-client";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "ai",
    operation: "seller.product.extract",
    locale: "en",
    timezone: "UTC",
  };
}

describe("persistent AI Runtime client", () => {
  it("persists one operation and its result around the canonical runtime", async () => {
    let runtimeCalls = 0;
    let results = 0;
    let statuses = 0;
    let persistedProviderId: string | undefined;
    let persistedModelId: string | undefined;

    const client = createPersistentAIRuntimeClient(
      {
        async execute() {
          runtimeCalls += 1;
          return {
            operationId: "operation-1",
            operationType: "seller.product.extract",
            operationVersion: 1,
            status: "succeeded" as const,
            output: { ok: true },
            providerId: "cloudflare-workers-ai",
            modelId: "@cf/test/model",
            safetyDecision: "allowed" as const,
            provenance: "ai_extracted" as const,
            warnings: [],
            retryable: false,
          };
        },
      },
      {
        async ensureOperationType() {
          return brandId<"EntityId">("operation-type-1");
        },
        async createOperation() {
          return {
            id: brandId<"EntityId">("operation-1"),
            organizationId: brandId<"EntityId">("tenant-1"),
            workspaceId: brandId<"EntityId">("workspace-1"),
            operationType: "seller.product.extract",
            operationVersion: 1,
            requestId: "req-1",
            correlationId: "corr-1",
            idempotencyKey: "idem-1",
            status: "created",
            inputReference: null,
            outputReference: null,
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:00:00.000Z",
          };
        },
        async setOperationStatus() {
          statuses += 1;
          return {} as never;
        },
        async recordResult(_context: RequestContext, input: { readonly providerId?: string; readonly modelId?: string }) {
          results += 1;
          persistedProviderId = input.providerId;
          persistedModelId = input.modelId;
        },
        async recordUsage() {},
      } as never,
      {
        id: () => brandId<"EntityId">(crypto.randomUUID()),
        now: () => "2026-09-22T00:01:00.000Z",
      },
    );

    const result = await client.execute({
      operationId: "operation-1",
      operationType: "seller.product.extract",
      operationVersion: 1,
      context: context(),
      businessId: "business-1",
      idempotencyKey: "idem-1",
      input: { sessionId: "session-1" },
      dataClassification: "internal",
      promptVersion: "1",
      outputSchemaVersion: "1",
      policyVersion: "1",
    });

    expect(result.status).toBe("succeeded");
    expect(runtimeCalls).toBe(1);
    expect(results).toBe(1);
    expect(statuses).toBe(1);
    expect(persistedProviderId).toBe("cloudflare-workers-ai");
    expect(persistedModelId).toBe("@cf/test/model");
  });

  it("replays a persisted terminal result without invoking the provider again", async () => {
    let runtimeCalls = 0;

    const client = createPersistentAIRuntimeClient(
      {
        async execute() {
          runtimeCalls += 1;
          throw new Error("provider must not be called for terminal replay");
        },
      },
      {
        async ensureOperationType() {
          return brandId<"EntityId">("operation-type-1");
        },
        async createOperation() {
          return {
            id: brandId<"EntityId">("operation-1"),
            organizationId: brandId<"EntityId">("tenant-1"),
            workspaceId: brandId<"EntityId">("workspace-1"),
            operationType: "seller.product.extract",
            operationVersion: 1,
            requestId: "req-1",
            correlationId: "corr-1",
            idempotencyKey: "idem-terminal-1",
            status: "succeeded",
            inputReference: null,
            outputReference: "r2://ai-results/operation-1",
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:01:00.000Z",
          };
        },
        async getResult() {
          return {
            status: "succeeded" as const,
            providerId: "cloudflare-workers-ai",
            modelId: "@cf/test/model",
            safetyOutcome: "allowed",
            provenance: ["ai_extracted"],
            warnings: ["persisted"],
          };
        },
      } as never,
      {
        id: () => brandId<"EntityId">(crypto.randomUUID()),
        now: () => "2026-09-22T00:02:00.000Z",
      },
    );

    const result = await client.execute({
      operationId: "operation-1",
      operationType: "seller.product.extract",
      operationVersion: 1,
      context: context(),
      businessId: "business-1",
      idempotencyKey: "idem-terminal-1",
      input: { sessionId: "session-1" },
      dataClassification: "internal",
      promptVersion: "1",
      outputSchemaVersion: "1",
      policyVersion: "1",
    });

    expect(result.status).toBe("succeeded");
    expect(result.providerId).toBe("cloudflare-workers-ai");
    expect(result.warnings).toContain("replayed_from_persisted_runtime_result");
    expect(runtimeCalls).toBe(0);
  });

  it("persists abstention without violating the operation status contract", async () => {
    let recordedStatus: string | undefined;

    const client = createPersistentAIRuntimeClient(
      {
        async execute() {
          return {
            operationId: "operation-abstain",
            operationType: "seller.product.extract",
            operationVersion: 1,
            status: "abstained" as const,
            safetyDecision: "abstained" as const,
            provenance: "none" as const,
            warnings: ["manual review"],
            retryable: false,
          };
        },
      },
      {
        async ensureOperationType() {
          return brandId<"EntityId">("operation-type-1");
        },
        async createOperation() {
          return {
            id: brandId<"EntityId">("operation-abstain"),
            organizationId: brandId<"EntityId">("tenant-1"),
            workspaceId: brandId<"EntityId">("workspace-1"),
            operationType: "seller.product.extract",
            operationVersion: 1,
            requestId: "req-1",
            correlationId: "corr-1",
            idempotencyKey: "idem-abstain-1",
            status: "created",
            inputReference: null,
            outputReference: null,
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:00:00.000Z",
          };
        },
        async setOperationStatus(_context: RequestContext, _id: EntityId, status: string) {
          recordedStatus = status;
          return {} as never;
        },
        async recordResult(_context: RequestContext, input: { readonly status: string }) {
          recordedStatus = input.status === "abstained" ? "blocked" : input.status;
        },
        async recordUsage() {},
      } as never,
      {
        id: () => brandId<"EntityId">(crypto.randomUUID()),
        now: () => "2026-09-22T00:02:00.000Z",
      },
    );

    const result = await client.execute({
      operationId: "operation-abstain",
      operationType: "seller.product.extract",
      operationVersion: 1,
      context: context(),
      businessId: "business-1",
      idempotencyKey: "idem-abstain-1",
      input: { sessionId: "session-1" },
      dataClassification: "internal",
      promptVersion: "1",
      outputSchemaVersion: "1",
      policyVersion: "1",
    });

    expect(result.status).toBe("abstained");
    expect(recordedStatus).toBe("blocked");
  });

});
