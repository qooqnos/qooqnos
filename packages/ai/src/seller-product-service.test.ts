import { describe, expect, it, vi } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { SellerProductService, SELLER_AI_OPERATION_TYPES } from "./seller-product-service";
import type { AIRequest, AIResult, SellerProductDraft } from "./types";

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

function draft(): SellerProductDraft {
  return {
    sessionId: brandId<"EntityId">("session-1"),
    version: 1,
    product: {},
    missingRequiredFields: [],
    conflicts: [],
    readyForSellerReview: true,
  };
}

describe("SellerProductService", () => {
  it("passes the trusted request context into the canonical AI runtime and persists only validated output", async () => {
    const saveDraft = vi.fn(async () => undefined);
    const execute = vi.fn(async <TOutput>(request: AIRequest): Promise<AIResult<TOutput>> => ({
      operationId: request.operationId,
      operationType: request.operationType,
      operationVersion: 1,
      status: "succeeded",
      output: draft() as TOutput,
      safetyDecision: "allowed",
      provenance: "ai_extracted",
      warnings: [],
      retryable: false,
    }));

    const service = new SellerProductService({
      repository: {
        async create() {},
        async addInput() {},
        saveDraft,
        async getDraft() { return null; },
      },
      runtime: { execute },
      id: () => brandId<"EntityId">("session-1"),
      now: () => "2026-09-16T00:00:00.000Z",
    });

    const result = await service.generateDraft(context(), brandId<"EntityId">("session-1"), {
      operationId: "op-1",
      operationType: "caller.supplied.operation",
      operationVersion: 99,
      idempotencyKey: "idem-1",
      input: { title: "Example" },
      dataClassification: "internal",
      promptVersion: "seller-product-v1",
      outputSchemaVersion: "seller-product-draft-v1",
      policyVersion: "seller-product-policy-v1",
    });

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      context: context(),
      operationType: SELLER_AI_OPERATION_TYPES.extract,
      operationVersion: 1,
    }));
    expect(saveDraft).toHaveBeenCalledOnce();
    expect(result.output).toEqual(draft());
  });

  it("rejects inputs before persistence when neither media nor text is supplied", async () => {
    const addInput = vi.fn(async () => undefined);
    const service = new SellerProductService({
      repository: {
        async create() {},
        addInput,
        async saveDraft() {},
        async getDraft() { return null; },
      },
      runtime: { execute: vi.fn() },
      id: () => brandId<"EntityId">("session-1"),
      now: () => "2026-09-16T00:00:00.000Z",
    });

    await expect(service.addInput(context(), brandId<"EntityId">("session-1"), {})).rejects.toThrow(
      "Seller product input requires media or raw text",
    );
    expect(addInput).not.toHaveBeenCalled();
  });
});
