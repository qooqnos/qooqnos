import { describe, expect, it, vi } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { SellerProductService, SELLER_AI_OPERATION_TYPES } from "./seller-product-service";
import type { AIRuntimeClient } from "./runtime-client";
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

function repository() {
  return {
    async create() {},
    async addInput() {},
    async saveDraft() {},
    async getDraft() { return null; },
    async reviewDraft() {},
    async confirmDraft() {},
    async cancelSession() { return true; },
  };
}

describe("SellerProductService", () => {
  it("passes the trusted request context into the canonical AI runtime and persists only validated output", async () => {
    const saveDraft = vi.fn(async () => undefined);
    const executeMock = vi.fn(async (request: AIRequest): Promise<AIResult<unknown>> => ({
      operationId: request.operationId,
      operationType: request.operationType,
      operationVersion: 1,
      status: "succeeded",
      output: draft(),
      safetyDecision: "allowed",
      provenance: "ai_extracted",
      warnings: [],
      retryable: false,
    }));
    const execute = executeMock as unknown as AIRuntimeClient["execute"];
    const repo = repository();
    repo.saveDraft = saveDraft;

    const service = new SellerProductService({
      repository: repo,
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

    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      context: context(),
      operationType: SELLER_AI_OPERATION_TYPES.extract,
      operationVersion: 1,
    }));
    expect(saveDraft).toHaveBeenCalledOnce();
    expect(result.output).toEqual(draft());
  });

  it("rejects inputs before persistence when neither media nor text is supplied", async () => {
    const addInput = vi.fn(async () => undefined);
    const repo = repository();
    repo.addInput = addInput;
    const service = new SellerProductService({
      repository: repo,
      runtime: { execute: vi.fn() },
      id: () => brandId<"EntityId">("session-1"),
      now: () => "2026-09-16T00:00:00.000Z",
    });

    await expect(service.addInput(context(), brandId<"EntityId">("session-1"), {})).rejects.toThrow(
      "Seller product input requires media or raw text",
    );
    expect(addInput).not.toHaveBeenCalled();
  });

  it("delegates draft review and confirmation with the caller-visible draft version", async () => {
    const reviewDraft = vi.fn(async () => undefined);
    const confirmDraft = vi.fn(async () => undefined);
    const repo = repository();
    repo.reviewDraft = reviewDraft;
    repo.confirmDraft = confirmDraft;
    const service = new SellerProductService({
      repository: repo,
      runtime: { execute: vi.fn() },
      id: () => brandId<"EntityId">("session-1"),
      now: () => "2026-09-16T00:00:00.000Z",
    });

    await service.reviewDraft(context(), brandId<"EntityId">("session-1"), 3);
    await service.confirmDraft(context(), brandId<"EntityId">("session-1"), 3);

    expect(reviewDraft).toHaveBeenCalledWith({
      context: context(),
      sessionId: brandId<"EntityId">("session-1"),
      version: 3,
      now: "2026-09-16T00:00:00.000Z",
    });
    expect(confirmDraft).toHaveBeenCalledWith({
      context: context(),
      sessionId: brandId<"EntityId">("session-1"),
      version: 3,
      now: "2026-09-16T00:00:00.000Z",
    });
  });

  it("returns cancellation outcome from the canonical repository", async () => {
    const cancelSession = vi.fn(async () => false);
    const repo = repository();
    repo.cancelSession = cancelSession;
    const service = new SellerProductService({
      repository: repo,
      runtime: { execute: vi.fn() },
      id: () => brandId<"EntityId">("session-1"),
      now: () => "2026-09-16T00:00:00.000Z",
    });

    await expect(service.cancelSession(context(), brandId<"EntityId">("session-1"))).resolves.toBe(false);
    expect(cancelSession).toHaveBeenCalledWith({
      context: context(),
      sessionId: brandId<"EntityId">("session-1"),
      now: "2026-09-16T00:00:00.000Z",
    });
  });
});
